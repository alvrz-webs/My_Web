/**
 * Redes sociales de Mario: una sola fuente para el pie, la página de contacto y el schema.org de
 * Google. Los logos de GitHub e Instagram son de simple-icons (CC0). El de LinkedIn (que simple-icons
 * retiró por un aviso legal de LinkedIn/Microsoft) está dibujado desde cero para esta web, así que no
 * hay derechos de terceros sobre el dibujo. Los logos son marcas de sus dueños: se usan solo para
 * enlazar al perfil, como permiten sus guías de marca.
 */
import { siGithub, siInstagram } from 'simple-icons';

// Dibujado desde cero para esta web (cuadrado con "in" calado; necesita fill-rule evenodd).
const LINKEDIN_PATH =
	'M3 0h18a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3zM4.7 6.5a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0zM5 9.4h3.2V19H5zM10.2 9.4h3.05v1.35c.45-.82 1.55-1.6 3.1-1.6c3.3 0 3.75 2.05 3.75 4.7V19h-3.2v-4.6c0-1.15-.05-2.6-1.6-2.6c-1.6 0-1.85 1.25-1.85 2.5V19h-3.25z';

/** @type {{ id: string, label: string, href: string, usuario: string, path: string, viewBox: string, color: string, relleno?: 'evenodd' | 'nonzero' }[]} */
export const REDES = [
	{
		id: 'linkedin',
		label: 'LinkedIn',
		href: 'https://www.linkedin.com/in/mario-álvarez-martínez-58a569390/',
		usuario: 'Mario Álvarez Martínez',
		path: LINKEDIN_PATH,
		viewBox: '0 0 24 24',
		relleno: 'evenodd',
		color: '#0A66C2',
	},
	{
		id: 'github',
		label: 'GitHub',
		href: 'https://github.com/Marioam200',
		usuario: 'Marioam200',
		path: siGithub.path,
		viewBox: '0 0 24 24',
		color: 'currentColor',
	},
	{
		id: 'instagram',
		label: 'Instagram',
		href: 'https://www.instagram.com/mario.a.m_200/',
		usuario: '@mario.a.m_200',
		path: siInstagram.path,
		viewBox: '0 0 24 24',
		color: '#E4405F',
	},
];

export const EMAIL = 'malvmar5@hotmail.com';
export const TELEFONO = '+34 656 867 231';
export const TELEFONO_TEL = 'tel:+34656867231';
