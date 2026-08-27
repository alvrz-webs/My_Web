// Selector de idioma: cada opción es un <a href> a la página estática real de ese idioma
// (igual que los enlaces ES/EN). Este script solo abre/cierra el desplegable y filtra la lista
// por texto; no hay traducción ni petición de red aquí.
function inicializar() {
	const botonGlobo = document.getElementById('lang-globe-btn');
	const menu = document.getElementById('lang-menu');
	if (!botonGlobo || !menu) return;

	const buscador = menu.querySelector('.lang-menu-buscador');
	const opciones = Array.from(menu.querySelectorAll('[data-busqueda]'));

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
			const coincide = consulta === '' || (opcion.dataset.busqueda ?? '').includes(consulta);
			opcion.closest('li').hidden = !coincide;
		});
	});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', inicializar);
} else {
	inicializar();
}
