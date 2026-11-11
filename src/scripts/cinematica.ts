/**
 * Capa cinemática de toda la web, con GSAP + ScrollTrigger. Se activa por atributos en el HTML:
 *
 * - data-entra             el bloque sube y aparece una vez al entrar (escalonado con --i).
 * - data-traza-al-entrar   las líneas de pista se dibujan al entrar en pantalla.
 * - data-parallax="N"      el elemento se desplaza N % de su alto mientras cruza la pantalla.
 * - data-expandir          marco de imagen que se abre desde un recorte mientras la foto se
 *                          asienta (la escala va en el hijo [data-expandir-capa]).
 * - data-deriva="N"        un rótulo grande que llega deslizándose N % en horizontal.
 *
 * Sin JavaScript o si este módulo falla, todo está visible: el estado oculto de las entradas solo
 * existe con la clase html.cine, que se pone aquí. Con movimiento reducido no se mueve nada.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const raiz = document.documentElement;
const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rtl = raiz.dir === 'rtl';

const marcar = (el: Element) => {
	el.classList.add('is-in');
	if (el.hasAttribute('data-traza-al-entrar')) el.classList.add('se-traza');
};

const SELECTOR_ENTRADAS = '[data-entra], [data-traza-al-entrar]';

if (reducido) {
	document.querySelectorAll(SELECTOR_ENTRADAS).forEach(marcar);
} else {
	// La clase y los disparadores se crean en la misma tarea: lo que ya está a la vista entra sin parpadeo
	raiz.classList.add('cine');
	ScrollTrigger.batch(SELECTOR_ENTRADAS, {
		start: 'top 92%',
		once: true,
		onEnter: (lote) => lote.forEach(marcar),
	});

	// Parallax: cada elemento recorre N % de su alto mientras cruza la pantalla
	gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
		const v = parseFloat(el.dataset.parallax || '10');
		gsap.fromTo(
			el,
			{ yPercent: -v / 2 },
			{
				yPercent: v / 2,
				ease: 'none',
				scrollTrigger: { trigger: el.closest('[data-parallax-marco]') ?? el, start: 'top bottom', end: 'bottom top', scrub: true },
			},
		);
	});

	// Imágenes que se expanden: el marco se abre desde un recorte con esquinas redondas y la
	// imagen, que entra algo más grande, se asienta a su tamaño (como un plano que se abre)
	gsap.utils.toArray<HTMLElement>('[data-expandir]').forEach((marco) => {
		const capa = marco.querySelector<HTMLElement>('[data-expandir-capa]');
		const tl = gsap.timeline({
			scrollTrigger: { trigger: marco, start: 'top 98%', end: 'top 38%', scrub: 0.7 },
		});
		tl.fromTo(
			marco,
			{ clipPath: 'inset(16% 14% 16% 14% round 14px)' },
			{ clipPath: 'inset(0% 0% 0% 0% round 4px)', ease: 'power2.out' },
			0,
		);
		if (capa) tl.fromTo(capa, { scale: 1.3 }, { scale: 1, ease: 'power2.out' }, 0);
	});

	// Rótulos grandes que llegan deslizándose
	gsap.utils.toArray<HTMLElement>('[data-deriva]').forEach((el) => {
		const v = parseFloat(el.dataset.deriva || '8') * (rtl ? -1 : 1);
		gsap.fromTo(
			el,
			{ xPercent: v },
			{ xPercent: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 45%', scrub: 0.8 } },
		);
	});

	// Las imágenes y las fuentes cambian alturas al cargar: recalcular los disparadores entonces
	window.addEventListener('load', () => ScrollTrigger.refresh());
	document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
