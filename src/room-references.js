// Reference facts only. These examples are deliberately separate from interiors.json:
// none has a verified house, floor or room placement.
export const roomReferences = {
  I: {
    title: 'Campus Süd I',
    houses: 'Older houses · 51, 53, 55, 57, 59',
    plans: [
      {
        title: 'Typical single room',
        description: 'The resident sketch labels an approximately 2.70 × 3.30 m living zone and a continuous clear ceiling of about 2.50 m. Kitchen, bathroom and entrance space are separate.',
        url: 'https://rommelwood.de/media/images/zimmerskizze.jpg',
        label: 'Open the room sketch',
      },
      {
        title: 'Accessible double apartment',
        description: 'A published example of the apartment arrangement. Its house, floor and orientation are not identified.',
        url: 'https://rommelwood.de/media/images/grundriss.png',
        label: 'Open the apartment drawing',
      },
    ],
    categories: 'Single category: 16.4 m². Double-share category: 20.2 m².',
    operatorUrl: 'https://werkswelt.de/data/uploads/wohnen/mietpreislisten/2026/erlangen/760-campus-sued-i-englisch-2026.pdf',
  },
  II: {
    title: 'Campus Süd II',
    houses: 'Newer houses · 49, 51a, 53a, 55a, 57a, 59a',
    plans: [
      {
        title: 'Typical newer single room',
        description: 'The resident drawing labels an approximately 2.92 × 3.50 m living zone and a 1.10 m window. Rooms can be mirrored; the window may be on the bed or desk side.',
        url: 'https://rommelwood.de/media/images/grundriss_neue_zimmer.svg',
        label: 'Open the room drawing',
      },
    ],
    categories: 'Single category: 19.4 m². Accessible single: 30.0 m². Group-share categories: 23.7–25.6 m².',
    operatorUrl: 'https://werkswelt.de/data/uploads/wohnen/mietpreislisten/2026/erlangen/766-campus-sued-ii-englisch-2026.pdf',
  },
};

export const roomReferenceSource = 'https://rommelwood.de/wohnen/zimmergrundriss/';
