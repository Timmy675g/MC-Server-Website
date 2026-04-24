export type NewsItem = {
  id: string;
  title: string;
  thumbnail: string;
  author: string;
  date: string;
  topic: string;
  preview: string;
  content: string;
};

export type FactionItem = {
  name: string;
  description: string;
  leader: string;
  members: number;
  territory: string;
  allegiances: string;
  power: number;
};

export const NEWS_ITEMS: NewsItem[] = [
  {
    id: 'Reset Announcement',
    title: 'The Server will be reseted soon! With More Content and such!',
    thumbnail: '/assets/server_reset.png',
    author: 'Timmy675g - Owner of SurvivalKendy',
    date: '2026-03-17',
    topic: 'Server News',
    preview:
      'Due to many players reported that they are bored in the current server, the server owner has decided to reset the server with more content and such!',
    content:
      'After talking with many teams and players, more than 70% reported they were bored with the current content cycle. The owner prepared a reset with new structures, expanded exploration, and upgraded hardware to improve gameplay quality.',
  },
  {
    id: 'Server Migration',
    title: 'The Server has just been Migrated to Indonesia from Singapore!',
    thumbnail: '/assets/server.jpg',
    author: 'Timmy675g - Owner of SurvivalKendy',
    date: '2026-03-08',
    topic: 'Server Tech',
    preview: 'The server migrated to Jakarta to optimize operating costs and improve sustainability.',
    content:
      'After bill observations, the owner migrated region and instance profile to keep the server healthy for long-term operation while preserving stable play quality.',
  },
  {
    id: 'Server Incident',
    title: 'The Server data has been accidentally reseted by the Owner!',
    thumbnail: '/assets/reset.png',
    author: 'Timmy675g - Owner of SurvivalKendy',
    date: '2026-03-07',
    topic: 'Server Tech',
    preview: 'A pipeline mistake caused temporary data reset and recovery from backups.',
    content:
      'While testing deployment pipelines, a sync command omission caused broad player data reset. Recovery was completed shortly after through backups.',
  },
  {
    id: 'Reported Monopolies',
    title: 'When will the monopolies end?',
    thumbnail: '/assets/monopoly.png',
    author: 'Timmy675g - Owner of SurvivalKendy',
    date: '2026-03-05',
    topic: 'Server News',
    preview: 'Teams discussed The End monopolies and options between waiting or taking action.',
    content:
      'Teams raised concerns about access control in The End. Leadership responses indicate the situation may relax based on future behavior and policy alignment.',
  },
];

export const PREVIOUS_FACTION_ITEMS: FactionItem[] = [
  {
    name: 'The Sinners of Mephistopheles:',
    description: 'We Are The Sinners.',
    leader: 'Zashura_the_enki',
    members: 6,
    territory: 'Unknown',
    allegiances: 'We must kill those fools.',
    power: 5,
  },
  {
    name: 'THE MAFIASS',
    description: 'A Team that supported a Communist style leadership and alliances',
    leader: 'VInee19',
    members: 6,
    territory: 'Unknown',
    allegiances: 'We will form an Alliance with anyone who supports our ideology.',
    power: 8,
  },
  {
    name: 'FreeMason',
    description: 'A team that does not accept those Communist',
    leader: 'septjrmyy',
    members: 4,
    territory: 'Unknown',
    allegiances: 'We are here for the stuff..',
    power: 4,
  },
  {
    name: 'The CA Kingdom',
    description: 'An Ally of THE MAFIASS',
    leader: '0dysseus_KOI',
    members: 4,
    territory: 'Unknown',
    allegiances: 'Lets get political!',
    power: 2,
  },
  {
    name: 'ax²+bx+c=0',
    description: 'Some smart players are on this team!',
    leader: 'gugu1446',
    members: 3,
    territory: 'Unknown',
    allegiances: 'Were interested in Minecraft.',
    power: 3,
  },
  {
    name: 'See no evil, Hear no evil',
    description: 'A team that does not care about politics and just want to have peace',
    leader: 'Sachiel_04',
    members: 3,
    territory: 'Unknown',
    allegiances: 'We just want to have fun and be friends with everyone.',
    power: 0.5,
  },
  {
    name: 'The Elythera',
    description: 'From the name you can guess that we are the one who loves Elytras',
    leader: 'Pcloud64',
    members: 3,
    territory: 'Unknown',
    allegiances: 'We will get those Elytras at all cost.',
    power: 2,
  },
  {
    name: 'KIBAK',
    description: 'A team of Boys',
    leader: 'Kenn',
    members: 7,
    territory: 'Unknown',
    allegiances: 'We will always be boys, always!',
    power: 9,
  },
];

export const CURRENT_FACTION_ITEMS: FactionItem[] = [];

// Backward compatibility export for existing imports.
export const FACTION_ITEMS: FactionItem[] = PREVIOUS_FACTION_ITEMS;

export function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
