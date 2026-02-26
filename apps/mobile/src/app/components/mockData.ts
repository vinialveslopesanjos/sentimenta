// Mock data for Sentimenta iOS app

export const userProfile = {
  name: "Julia",
  email: "julia@sentimenta.io",
  avatar: "JB",
  plan: "Pro",
};

export const connections = [
  {
    id: "conn-1",
    platform: "instagram",
    username: "@vini_alvees",
    followers: 1018,
    status: "active",
    lastSync: "16 Fev. 2026",
    postsAnalyzed: 58,
    commentsCollected: 330,
  },
  {
    id: "conn-2",
    platform: "youtube",
    username: "@julia_brand",
    followers: 4520,
    status: "active",
    lastSync: "15 Fev. 2026",
    postsAnalyzed: 23,
    commentsCollected: 1240,
  },
];

export const dashboardKPIs = {
  connections: 3,
  connectionsNew: 1,
  posts: 47,
  postsWeek: 5,
  comments: 10812,
  commentsMonth: "comentarios/mes",
  score: 8.5,
  scoreDelta: 0.4,
};

export const connectionKPIs = {
  scoreMedio: 6.8,
  taxaNegativa: "8%",
  polaridade: 0.46,
  comentarios: 330,
  engajamento: 5523,
  posts: 58,
};

export const monthlyDistribution = [
  { month: "02/2023", positivo: 60, neutro: 25, negativo: 15 },
  { month: "07/2023", positivo: 55, neutro: 30, negativo: 15 },
  { month: "02/2024", positivo: 65, neutro: 25, negativo: 10 },
  { month: "05/2024", positivo: 70, neutro: 22, negativo: 8 },
  { month: "10/2024", positivo: 68, neutro: 24, negativo: 8 },
  { month: "03/2025", positivo: 72, neutro: 20, negativo: 8 },
  { month: "06/2025", positivo: 75, neutro: 18, negativo: 7 },
  { month: "01/2026", positivo: 78, neutro: 17, negativo: 5 },
];

export const commentVolume = [
  { month: "08/2016", count: 2 },
  { month: "06/2017", count: 5 },
  { month: "09/2017", count: 8 },
  { month: "04/2019", count: 30 },
  { month: "07/2019", count: 12 },
  { month: "07/2021", count: 15 },
  { month: "11/2022", count: 8 },
  { month: "01/2024", count: 6 },
  { month: "11/2024", count: 4 },
  { month: "01/2026", count: 10 },
];

export const scoreTrend = [
  { day: "06/2019", score: 7.2 },
  { day: "08/2019", score: 6.5 },
  { day: "10/2019", score: 7.8 },
  { day: "01/2020", score: 5.4 },
  { day: "04/2020", score: 8.1 },
  { day: "07/2020", score: 6.9 },
  { day: "10/2020", score: 7.5 },
  { day: "01/2021", score: 5.8 },
  { day: "04/2021", score: 7.3 },
  { day: "07/2021", score: 6.2 },
  { day: "10/2021", score: 8.0 },
  { day: "01/2022", score: 7.1 },
  { day: "04/2022", score: 6.8 },
  { day: "07/2022", score: 7.6 },
  { day: "10/2022", score: 5.9 },
  { day: "01/2023", score: 7.4 },
  { day: "07/2023", score: 6.5 },
  { day: "01/2024", score: 7.8 },
  { day: "07/2024", score: 6.8 },
  { day: "01/2025", score: 7.0 },
  { day: "08/2025", score: 6.5 },
  { day: "01/2026", score: 6.8 },
];

export const temporalAnalysis = {
  sentimento: [
    { period: "08/2016", positivo: 4, neutro: 2, negativo: 1 },
    { period: "09/2017", positivo: 8, neutro: 6, negativo: 2 },
    { period: "04/2019", positivo: 24, neutro: 10, negativo: 4 },
    { period: "07/2021", positivo: 12, neutro: 6, negativo: 2 },
    { period: "11/2022", positivo: 6, neutro: 4, negativo: 1 },
    { period: "01/2024", positivo: 5, neutro: 3, negativo: 1 },
    { period: "11/2024", positivo: 4, neutro: 2, negativo: 0 },
    { period: "01/2026", positivo: 8, neutro: 4, negativo: 1 },
  ],
};

export const emotions = [
  { name: "Alegria", value: 63, color: "#22D3EE" },
  { name: "Neutro", value: 26, color: "#8B5CF6" },
  { name: "Tristeza", value: 3, color: "#67E8F9" },
  { name: "Surpresa", value: 3, color: "#A78BFA" },
  { name: "Raiva", value: 3, color: "#F472B6" },
  { name: "Nojo", value: 1, color: "#C4B5FD" },
  { name: "Medo", value: 0, color: "#E2E8F0" },
];

export const topics = [
  { name: "Elogio", value: 25, color: "#22D3EE" },
  { name: "Aparencia", value: 14, color: "#06B6D4" },
  { name: "Beleza", value: 11, color: "#67E8F9" },
  { name: "Esporte", value: 9, color: "#22D3EE" },
  { name: "Estilo", value: 9, color: "#06B6D4" },
  { name: "Localizacao", value: 6, color: "#67E8F9" },
  { name: "Amor", value: 6, color: "#22D3EE" },
  { name: "Familia", value: 6, color: "#06B6D4" },
  { name: "Viagem", value: 6, color: "#67E8F9" },
  { name: "Amizade", value: 6, color: "#22D3EE" },
];

export const sentimentDistribution = {
  positivo: { count: 207, percent: 63 },
  neutro: { count: 97, percent: 29 },
  negativo: { count: 26, percent: 8 },
};

export const recentPosts = [
  {
    id: "post-1",
    title: "A vida eh uma ladeira me observe subirrrr",
    platform: "Instagram",
    comments: 3,
    date: "24 Jul. 2022",
    score: 8.7,
    thumbnail: "",
  },
  {
    id: "post-2",
    title: "20 e quatro anos ja ja vem os 30 ;((((",
    platform: "Instagram",
    comments: 12,
    date: "09 Mar. 2024",
    score: 8.3,
  },
  {
    id: "post-3",
    title: "A mente quer motivos, nao compromissos",
    platform: "Instagram",
    comments: 4,
    date: "22 Set. 2017",
    score: 8.3,
  },
  {
    id: "post-4",
    title: "2025",
    platform: "Instagram",
    comments: 18,
    date: "01 Jan. 2025",
    score: 6.8,
  },
  {
    id: "post-5",
    title: "I'm mad but i ain't stressin'",
    platform: "Instagram",
    comments: 4,
    date: "24 Nov. 2024",
    score: 8.0,
  },
  {
    id: "post-6",
    title: "Post sem texto",
    platform: "Instagram",
    comments: 15,
    date: "26 Jan. 2020",
    score: 7.8,
  },
  {
    id: "post-7",
    title: "O pai estava midia nesse fds",
    platform: "Instagram",
    comments: 8,
    date: "12 Abr. 2022",
    score: 7.5,
  },
  {
    id: "post-8",
    title: "Tudo e pra sempre",
    platform: "Instagram",
    comments: 5,
    date: "01 Ago. 2016",
    score: 8.2,
  },
];

export const postComments = [
  {
    id: "c1",
    score: 10.0,
    author: "ingryd.castelo.reis",
    text: "Melhores sogros",
    aiNote: "Elogio aos sogros, considerados os melhores",
    tag: "Alegria",
    likes: 2,
    date: "Ha 3d",
  },
  {
    id: "c2",
    score: 10.0,
    author: "ingryd.castelo.reis",
    text: "Melhor namorado",
    aiNote: "Elogio ao namorado, considerado o melhor",
    tag: "Alegria",
    likes: 1,
    date: "Ha 3d",
  },
  {
    id: "c3",
    score: 10.0,
    author: "annavicb_",
    text: "Perfeitooo",
    aiNote: "Expressao de entusiasmo e amor",
    tag: "Alegria",
    likes: 1,
    date: "Ha 5d",
  },
  {
    id: "c4",
    score: 10.0,
    author: "cesaaum",
    text: "parabeuins, negrao! Muita saude e muita luz no seu caminho.",
    aiNote: "Parabens com votos de saude e luz",
    tag: "Alegria",
    likes: 0,
    date: "Ha 7d",
  },
  {
    id: "c5",
    score: 10.0,
    author: "mariahbarbarap",
    text: "lindo mozi que sdd te amo mto",
    aiNote: "Expressao de amor e saudade",
    tag: "Alegria",
    likes: 3,
    date: "Ha 10d",
  },
  {
    id: "c6",
    score: 8.0,
    author: "dtosamjos",
    text: "Lindao",
    aiNote: "Elogio intenso a beleza",
    tag: "Alegria",
    likes: 1,
    date: "Ha 12d",
  },
  {
    id: "c7",
    score: 8.0,
    author: "dtosamjos",
    text: "Grande homem amamos vc!",
    aiNote: "Expressao de admiracao e carinho",
    tag: "Admiracao",
    likes: 0,
    date: "Ha 14d",
  },
  {
    id: "c8",
    score: 8.0,
    author: "lisanatos..",
    text: "voce e lindo hein",
    aiNote: "Elogio a aparencia fisica",
    tag: "Beleza",
    likes: 2,
    date: "Ha 15d",
  },
];

export const logs = [
  {
    id: "log-1",
    date: "20 Fev. 2026 14:32",
    status: "completed",
    duration: "2m 14s",
    posts: 12,
    comments: 145,
    costBRL: "R$ 0,87",
    profile: "@vini_alvees",
  },
  {
    id: "log-2",
    date: "19 Fev. 2026 09:15",
    status: "completed",
    duration: "4m 02s",
    posts: 25,
    comments: 312,
    costBRL: "R$ 1,87",
    profile: "@vini_alvees",
  },
  {
    id: "log-3",
    date: "18 Fev. 2026 22:00",
    status: "partial",
    duration: "1m 45s",
    posts: 8,
    comments: 67,
    costBRL: "R$ 0,40",
    profile: "@julia_brand",
  },
  {
    id: "log-4",
    date: "17 Fev. 2026 16:20",
    status: "failed",
    duration: "0m 23s",
    posts: 0,
    comments: 0,
    costBRL: "R$ 0,00",
    profile: "@vini_alvees",
    error: "Timeout na API do Instagram",
  },
  {
    id: "log-5",
    date: "16 Fev. 2026 10:00",
    status: "completed",
    duration: "6m 38s",
    posts: 58,
    comments: 524,
    costBRL: "R$ 3,14",
    profile: "@vini_alvees",
  },
  {
    id: "log-6",
    date: "15 Fev. 2026 08:30",
    status: "running",
    duration: "em andamento...",
    posts: 3,
    comments: 18,
    costBRL: "R$ 0,11",
    profile: "@julia_brand",
  },
];

export const alerts = [
  {
    id: "a1",
    type: "warning",
    title: "Aumento de comentarios negativos",
    description: "O post '20 e quatro anos...' teve 3 comentarios negativos nas ultimas 24h.",
    date: "Ha 2h",
    read: false,
  },
  {
    id: "a2",
    type: "info",
    title: "Nova tendencia detectada",
    description: "O topico 'Estilo' cresceu 40% nos ultimos 7 dias.",
    date: "Ha 6h",
    read: false,
  },
  {
    id: "a3",
    type: "success",
    title: "Score em alta!",
    description: "Seu score medio subiu para 8.5 esta semana.",
    date: "Ha 1d",
    read: true,
  },
  {
    id: "a4",
    type: "warning",
    title: "Palavra recorrente: preco",
    description: "15 comentarios mencionam 'preco' ou 'caro' no ultimo mes.",
    date: "Ha 2d",
    read: true,
  },
  {
    id: "a5",
    type: "info",
    title: "Sync agendado",
    description: "Proxima sincronizacao automatica em 6h para @vini_alvees.",
    date: "Ha 3d",
    read: true,
  },
];

export const aiReport = {
  lastUpdate: "Atualizado agora",
  profile: "@julia_brand",
  period: "Ultimas 24h",
  summary:
    "Sua audiencia esta em clima de celebracao. O lancamento de ontem gerou pico de alegria (72%) e admiracao. O tom e de proximidade, com leve confusao sobre o prazo de entrega nos comentarios.",
  strengths:
    "Humanizacao forte: o video de bastidores teve 0% de sarcasmo percebido. A nova paleta de cores foi o topico mais elogiado, com 142 mencoes positivas.",
  attention:
    "Duvida recorrente: 15 comentarios pedem o link do frete. Ha 3 comentarios ironizando preco, ainda sem forca de crise.",
  nextStep:
    "Julia, grave um Story rapido de 15 segundos reforcando onde esta o link do frete e agradecendo os elogios sobre a nova identidade. Momento ideal para converter essa energia em vendas.",
};

export const postDetail = {
  id: "post-4",
  platform: "Instagram",
  type: "Imagem",
  title: "2025",
  date: "01 Jan. 2025, 19:32",
  likes: 1,
  commentsCount: 18,
  scoreMedio: 6.8,
  scorePredominante: null,
  comentariosAnalisados: 11,
  polaridade: 0.46,
  emotions: ["Alegria", "Neutro", "Surpresa"],
  topics: ["Elogio", "Beleza"],
  sentimentDist: {
    positivo: { percent: 55 },
    neutro: { percent: 45 },
    negativo: { percent: 0 },
  },
};
