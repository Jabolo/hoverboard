export const EVENT_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://warsaw.devfest.pl/#website',
      url: 'https://warsaw.devfest.pl/',
      name: 'GDG DevFest Warsaw 2026',
      inLanguage: 'en',
    },
    {
      '@type': 'Organization',
      '@id': 'https://warsaw.devfest.pl/#organization',
      name: 'Google Developer Groups Warsaw',
      url: 'https://gdg.community.dev/gdg-warszawa/',
      sameAs: [
        'https://gdg.community.dev/gdg-warszawa/',
        'https://www.meetup.com/GDG-Warszawa/',
        'https://www.facebook.com/gdgwarszawa',
        'https://www.instagram.com/gdgwarszawa/',
        'https://www.youtube.com/c/GdgWarszawaPl/featured',
      ],
    },
    {
      '@type': 'Event',
      '@id': 'https://warsaw.devfest.pl/#event',
      name: 'GDG DevFest Warsaw 2026',
      description:
        'A one-day, community-led technology conference bringing developers, designers, entrepreneurs, engineers, researchers, and students together at Google for Startups Campus Warsaw. Theme: Real Work, Real Lessons.',
      startDate: '2026-11-21T09:00:00+01:00',
      endDate: '2026-11-21T21:00:00+01:00',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      image: ['https://warsaw.devfest.pl/images/backgrounds/home-2026.png'],
      url: 'https://warsaw.devfest.pl/',
      inLanguage: 'en',
      location: {
        '@type': 'Place',
        name: 'Google for Startups Campus Warsaw',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Plac Konesera 10',
          postalCode: '03-736',
          addressLocality: 'Warszawa',
          addressCountry: 'PL',
        },
      },
      organizer: {
        '@id': 'https://warsaw.devfest.pl/#organization',
      },
      keywords:
        'GDG DevFest Warsaw, developer conference Warsaw, technology conference Poland, Google Cloud, AI, machine learning, Firebase, Android, web performance, open source',
    },
  ],
} as const;

export const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': 'https://warsaw.devfest.pl/faq#faq',
  url: 'https://warsaw.devfest.pl/faq',
  inLanguage: 'en',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'When and where is it happening?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The event takes place on November 21, 2026, at Google for Startups Campus Warsaw, Plac Konesera 10, 03-736 Warszawa.',
      },
    },
    {
      '@type': 'Question',
      name: 'What time does registration open?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Registration opens at 09:00. The complete timetable will be announced as sessions and workshops are confirmed.',
      },
    },
    {
      '@type': 'Question',
      name: 'Who is the event for?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Developers, designers, engineers, researchers, students, entrepreneurs, and anyone interested in learning and sharing around technology.',
      },
    },
    {
      '@type': 'Question',
      name: 'What topics will GDG DevFest Warsaw cover?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Current focus areas include Practical AI & ML, Google Cloud, Build with AI, AI Antigravity Agent Dev Kit (ADK), Gemini & Gemma, Firebase, Web & Performance, Mobile & Android, Open Source, and Engineering Culture.',
      },
    },
    {
      '@type': 'Question',
      name: 'How can I speak at DevFest Warsaw?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The Call for Papers is officially open. Visit the Advocu CFP submission page to apply. The published deadline is October 4, 2026 at 23:45 Europe/Warsaw.',
      },
    },
  ],
} as const;
