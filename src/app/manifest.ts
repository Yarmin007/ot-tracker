import type { MetadataRoute } from 'next';

// Lets the app be added to a phone's home screen with the school crest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hamad School OT Sheet',
    short_name: 'Hamad OT',
    description: 'ޙަމަދު ސުކޫލް - އިތުރުގަޑީގައި ކުރާ މަސައްކަތުގެ ރެކޯޑް',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#991525',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
