/** Copy e perfis do seed de pitch  -  fonte única de narrativa. */

export const CORE_ACCOUNTS = [
  { email: "admin@demo.pt", role: "Administrador" },
  { email: "organizador@demo.pt", role: "Organizador (Câmara de Matosinhos)" },
  { email: "voluntario1@demo.pt", role: "Voluntário" },
  { email: "voluntario2@demo.pt", role: "Voluntário" },
  { email: "bloqueado@demo.pt", role: "Bloqueado (login falha)" }
]

export const EXTRA_ACCOUNTS = [
  { email: "organizador2@demo.pt", role: "Organizador (Câmara de Espinho)" },
  { email: "voluntario3@demo.pt", role: "Voluntário" },
  { email: "voluntario4@demo.pt", role: "Voluntário" },
  { email: "voluntario5@demo.pt", role: "Voluntário" },
  ...Array.from({ length: 10 }, (_, i) => ({
    email: `voluntario${i + 6}@demo.pt`,
    role: "Voluntário"
  }))
]

export const EXTRA_VOLUNTEER_PROFILES = [
  { name: "Filipa Nunes", birthDate: "1996-03-08", phone: "912345678" },
  { name: "Gonçalo Ribeiro", birthDate: "1997-11-21", phone: "913456789" },
  { name: "Helena Castro", birthDate: "1998-05-14", phone: "914567890" },
  { name: "Laura Duarte", birthDate: "1999-09-02", phone: "915678901" },
  { name: "Mário Henriques", birthDate: "2000-12-30", phone: "916789012" },
  { name: "Natália Freitas", birthDate: "2001-04-17", phone: "917890123" },
  { name: "Paula Gomes", birthDate: "1996-07-25", phone: "918901234" },
  { name: "Ricardo Lopes", birthDate: "1998-01-09", phone: "919012345" },
  { name: "Teresa Machado", birthDate: "1999-10-11", phone: "920123456" },
  { name: "Ulisses Costa", birthDate: "2002-02-28", phone: "921234567" }
]

export const COMPLETED_CAMPAIGN_COMMENTS = [
  {
    userKey: "volunteer1",
    body: "Boa organização no ponto de encontro. Conseguimos limpar toda a zona do passadiço em duas horas.",
    isVisible: true
  },
  {
    userKey: "volunteer3",
    body: "Encontrámos muitas tampas de plástico junto às dunas. Vale a pena repetir a acção na primavera.",
    isVisible: true
  },
  {
    userKey: "volunteer4",
    body: "Equipa da Câmara disponibilizou sacos e luvas suficientes para toda a equipa.",
    isVisible: true
  },
  {
    userKey: "volunteer5",
    body: "A praia da Codicheira estava mais limpa do que esperávamos, mas ainda recolhemos bastante vidro.",
    isVisible: true
  },
  {
    userKey: "volunteer6",
    body: "Gostei de ver famílias com crianças a participar. Ambiente muito positivo.",
    isVisible: true
  },
  {
    userKey: "volunteer7",
    body: "Sugiro marcar a próxima acção mais cedo, antes da maré alta.",
    isVisible: true
  },
  {
    userKey: "volunteer8",
    body: "O registo de resíduos na plataforma é simples. Ajudou a fechar o relatório no próprio dia.",
    isVisible: true
  },
  {
    userKey: "admin",
    body: "Relatório municipal enviado. Obrigado a todos os voluntários.",
    isVisible: true
  },
  {
    userKey: "volunteer9",
    body: "Comentário oculto  -  aguarda moderação.",
    isVisible: false
  },
  {
    userKey: "volunteer10",
    body: "Repetiria sem hesitar. Boa comunicação antes e durante a acção.",
    isVisible: true
  }
]
