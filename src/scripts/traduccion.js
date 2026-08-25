const ALMACEN_IDIOMA = 'idioma_traduccion';
const ENDPOINT = '/api/traducir';
const AVISO_DURACION_MS = 5000;

let aplicando = false;
let idiomaActivo = null;

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

async function pedirTraduccion(textos, codigo) {
	const response = await fetch(ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ruta: location.pathname, idioma: codigo, textos }),
	});

	if (!response.ok) {
		let detalle = '';
		try {
			detalle = (await response.json())?.error ?? '';
		} catch {}
		throw new Error(`HTTP ${response.status}${detalle ? `: ${detalle}` : ''}`);
	}

	const data = await response.json();
	if (!data.ok || !Array.isArray(data.traducciones) || data.traducciones.length !== textos.length) {
		throw new Error('Respuesta de traducción con formato inesperado');
	}

	return data;
}

async function aplicarTraduccion(codigo, ayudantes) {
	if (aplicando) return;
	aplicando = true;
	ayudantes.marcarCargando(true);

	try {
		const nodos = nodosDeTextoTraducibles(document.body);
		if (nodos.length === 0) return;

		const textos = nodos.map((nodo) => nodo.nodeValue);
		const data = await pedirTraduccion(textos, codigo);

		nodos.forEach((nodo, i) => {
			nodo.nodeValue = data.traducciones[i];
		});

		document.documentElement.lang = codigo;
		localStorage.setItem(ALMACEN_IDIOMA, codigo);
		idiomaActivo = codigo;
		ayudantes.actualizarInsignia(codigo);
		ayudantes.marcarSeleccionActiva(codigo);

		if (data.parcial) {
			ayudantes.mostrarAviso(ayudantes.textoParcial);
		}
	} catch (error) {
		// Fallo de red, timeout, JSON inesperado, 5xx del servidor... se deja el contenido en su
		// idioma original, nunca se rompe la página por esto, pero sí se avisa (consola +
		// mensaje discreto) en vez de fallar en silencio.
		console.error('No se pudo traducir la página:', error);
		ayudantes.mostrarAviso(ayudantes.textoError);
	} finally {
		aplicando = false;
		ayudantes.marcarCargando(false);
	}
}

// Re-traduce solo los nodos de texto nuevos que aparezcan tras la traducción inicial (por
// ejemplo contenido inyectado por otro script), sin repetir la página entera.
function observarContenidoNuevo(ayudantes) {
	const observer = new MutationObserver((mutations) => {
		if (!idiomaActivo || aplicando) return;

		const nodosNuevos = [];
		for (const mutation of mutations) {
			for (const nodo of mutation.addedNodes) {
				if (nodo.nodeType === Node.TEXT_NODE) {
					if (nodo.nodeValue?.trim() && !nodoExcluido(nodo)) nodosNuevos.push(nodo);
				} else if (nodo.nodeType === Node.ELEMENT_NODE) {
					nodosNuevos.push(...nodosDeTextoTraducibles(nodo));
				}
			}
		}
		if (nodosNuevos.length === 0) return;

		const codigo = idiomaActivo;
		pedirTraduccion(
			nodosNuevos.map((n) => n.nodeValue),
			codigo,
		)
			.then((data) => {
				nodosNuevos.forEach((nodo, i) => {
					nodo.nodeValue = data.traducciones[i];
				});
			})
			.catch((error) => console.error('No se pudo traducir contenido nuevo:', error));
	});

	observer.observe(document.body, { childList: true, subtree: true });
}

function inicializar() {
	const botonGlobo = document.getElementById('lang-globe-btn');
	const menu = document.getElementById('lang-menu');
	if (!botonGlobo || !menu) return;

	const insignia = botonGlobo.querySelector('.lang-globe-badge');
	const buscador = menu.querySelector('.lang-menu-buscador');
	const opciones = Array.from(menu.querySelectorAll('[data-lang]'));
	const codigosValidos = new Set(opciones.map((opcion) => opcion.dataset.lang).filter((codigo) => codigo !== '__original__'));

	const aviso = document.createElement('p');
	aviso.className = 'lang-aviso';
	aviso.setAttribute('role', 'status');
	aviso.hidden = true;
	document.querySelector('.lang-selector')?.appendChild(aviso);
	let idAvisoTimeout;

	function mostrarAviso(texto) {
		aviso.textContent = texto;
		aviso.hidden = false;
		clearTimeout(idAvisoTimeout);
		idAvisoTimeout = setTimeout(() => {
			aviso.hidden = true;
		}, AVISO_DURACION_MS);
	}

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

	function marcarSeleccionActiva(codigo) {
		opciones.forEach((opcion) => {
			const seleccionada = codigo ? opcion.dataset.lang === codigo : opcion.dataset.lang === '__original__';
			opcion.classList.toggle('is-selected', seleccionada);
			opcion.setAttribute('aria-selected', String(seleccionada));
		});
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

	const ayudantes = {
		marcarCargando,
		actualizarInsignia,
		marcarSeleccionActiva,
		mostrarAviso,
		textoError: botonGlobo.dataset.textoError || 'No se pudo traducir la página.',
		textoParcial: botonGlobo.dataset.textoParcial || 'Traducción parcial: parte del texto sigue en el idioma original.',
	};

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

			aplicarTraduccion(codigo, ayudantes);
		});
	});

	// Volver a ES/EN de forma explícita también cuenta como "volver al original": si no,
	// al aterrizar en la página nativa se re-aplicaría automáticamente la última traducción.
	document.querySelectorAll('.lang-switch > a').forEach((enlace) => {
		enlace.addEventListener('click', () => {
			localStorage.removeItem(ALMACEN_IDIOMA);
		});
	});

	observarContenidoNuevo(ayudantes);

	const guardado = localStorage.getItem(ALMACEN_IDIOMA);
	if (guardado && codigosValidos.has(guardado)) {
		actualizarInsignia(guardado);
		marcarSeleccionActiva(guardado);
		aplicarTraduccion(guardado, ayudantes);
	} else {
		marcarSeleccionActiva(null);
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', inicializar);
} else {
	inicializar();
}
