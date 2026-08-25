const ALMACEN_IDIOMA = 'idioma_traduccion';
const ENDPOINT = '/api/traducir';

let aplicando = false;

// Elementos que no deben traducirse: donde no hay texto visible de verdad (script/style),
// campos editables por el usuario (input/textarea/select), y cualquier cosa marcada
// explícitamente con data-no-traducir (el propio selector de idioma: sus nombres de idioma
// están en su idioma nativo y no deben pasar por la traducción).
function nodoExcluido(nodo) {
	const padre = nodo.parentElement;
	if (!padre) return true;
	if (padre.closest('script, style, noscript, input, textarea, select, option')) return true;
	if (padre.closest('[data-no-traducir]')) return true;
	return false;
}

function nodosDeTextoTraducibles(raiz) {
	const nodos = [];
	const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
		acceptNode(nodo) {
			if (!nodo.nodeValue || !nodo.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
			if (nodoExcluido(nodo)) return NodeFilter.FILTER_REJECT;
			return NodeFilter.FILTER_ACCEPT;
		},
	});

	let actual;
	while ((actual = walker.nextNode())) nodos.push(actual);
	return nodos;
}

async function aplicarTraduccion(codigo, marcarCargando, actualizarInsignia) {
	if (aplicando) return;
	aplicando = true;
	marcarCargando(true);

	try {
		const nodos = nodosDeTextoTraducibles(document.body);
		if (nodos.length === 0) return;

		const textos = nodos.map((nodo) => nodo.nodeValue);

		const response = await fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ruta: location.pathname, idioma: codigo, textos }),
		});

		if (!response.ok) return;

		const data = await response.json();
		if (!data.ok || !Array.isArray(data.traducciones) || data.traducciones.length !== nodos.length) return;

		nodos.forEach((nodo, i) => {
			nodo.nodeValue = data.traducciones[i];
		});

		localStorage.setItem(ALMACEN_IDIOMA, codigo);
		actualizarInsignia(codigo);
	} catch (error) {
		// Fallo de red, timeout, JSON inesperado... se deja el contenido en su idioma original,
		// nunca se rompe la página por esto.
		console.error('No se pudo traducir la página:', error);
	} finally {
		aplicando = false;
		marcarCargando(false);
	}
}

function inicializar() {
	const botonGlobo = document.getElementById('lang-globe-btn');
	const menu = document.getElementById('lang-menu');
	if (!botonGlobo || !menu) return;

	const insignia = botonGlobo.querySelector('.lang-globe-badge');
	const buscador = menu.querySelector('.lang-menu-buscador');
	const opciones = Array.from(menu.querySelectorAll('[data-lang]'));
	const codigosValidos = new Set(opciones.map((opcion) => opcion.dataset.lang).filter((codigo) => codigo !== '__original__'));

	function actualizarInsignia(codigo) {
		if (codigo) {
			insignia.hidden = false;
			insignia.textContent = codigo.toUpperCase();
			botonGlobo.classList.add('is-active');
		} else {
			insignia.hidden = true;
			botonGlobo.classList.remove('is-active');
		}
	}

	function marcarCargando(cargando) {
		botonGlobo.classList.toggle('is-loading', cargando);
	}

	function abrirMenu() {
		menu.hidden = false;
		botonGlobo.setAttribute('aria-expanded', 'true');
		buscador?.focus();
	}

	function cerrarMenu() {
		menu.hidden = true;
		botonGlobo.setAttribute('aria-expanded', 'false');
	}

	botonGlobo.addEventListener('click', () => {
		if (menu.hidden) abrirMenu();
		else cerrarMenu();
	});

	document.addEventListener('click', (event) => {
		if (menu.hidden) return;
		if (menu.contains(event.target) || botonGlobo.contains(event.target)) return;
		cerrarMenu();
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') cerrarMenu();
	});

	buscador?.addEventListener('input', () => {
		const consulta = buscador.value.trim().toLowerCase();
		opciones.forEach((opcion) => {
			if (opcion.dataset.lang === '__original__') return;
			const coincide = consulta === '' || (opcion.dataset.busqueda ?? '').includes(consulta);
			opcion.closest('li').hidden = !coincide;
		});
	});

	opciones.forEach((opcion) => {
		opcion.addEventListener('click', () => {
			const codigo = opcion.dataset.lang;
			cerrarMenu();

			if (codigo === '__original__') {
				localStorage.removeItem(ALMACEN_IDIOMA);
				location.reload();
				return;
			}

			aplicarTraduccion(codigo, marcarCargando, actualizarInsignia);
		});
	});

	// Volver a ES/EN de forma explícita también cuenta como "volver al original": si no,
	// al aterrizar en la página nativa se re-aplicaría automáticamente la última traducción.
	document.querySelectorAll('.lang-switch > a').forEach((enlace) => {
		enlace.addEventListener('click', () => {
			localStorage.removeItem(ALMACEN_IDIOMA);
		});
	});

	const guardado = localStorage.getItem(ALMACEN_IDIOMA);
	if (guardado && codigosValidos.has(guardado)) {
		actualizarInsignia(guardado);
		aplicarTraduccion(guardado, marcarCargando, actualizarInsignia);
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', inicializar);
} else {
	inicializar();
}
