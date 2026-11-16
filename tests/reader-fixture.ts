import type { LibraryState, ReaderDocument } from "@/shared/types";

const books = [
  {
    id: "dom-casmurro",
    title: "Dom Casmurro",
    author: "Machado de Assis",
    color: "#244c46",
    status: "reading",
    format: "EPUB",
    page: 1,
    collections: ["literatura"],
    content: [
      "Do título\n\nUma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central um rapaz aqui do bairro, que eu conheço de vista e de chapéu. Cumprimentou-me, sentou-se ao pé de mim, falou da lua e dos ministros, e acabou recitando-me versos. A viagem era curta, e os versos pode ser que não fossem inteiramente maus. Sucedeu, porém, que, como eu estava cansado, fechei os olhos três ou quatro vezes; tanto bastou para que ele interrompesse a leitura e metesse os versos no bolso.",
      "Do livro\n\nAgora que expliquei o título, passo a escrever o livro. Antes disso, porém, digamos os motivos que me põem a pena na mão.\n\nVivo só, com um criado. A casa em que moro é própria; fi-la construir de propósito, levado de um desejo tão particular que me vexa imprimi-lo, mas vá lá. Um dia, há bastantes anos, lembrou-me reproduzir no Engenho Novo a casa em que me criei na antiga Rua de Matacavalos, dando-lhe o mesmo aspecto e economia daquela outra, que desapareceu.\n\nO meu fim evidente era atar as duas pontas da vida, e restaurar na velhice a adolescência. Pois, senhor, não consegui recompor o que foi nem o que fui. Em tudo, se o rosto é igual, a fisionomia é diferente.",
      "A denúncia\n\nIa a entrar na sala de visitas, quando ouvi proferir o meu nome e escondi-me atrás da porta. A casa era a da Rua de Matacavalos, o mês novembro, o ano é que é um tanto remoto, mas eu não hei de trocar as datas à minha vida só para agradar às pessoas que não amam histórias velhas; o ano era de 1857.\n\n— D. Glória, a senhora persiste na ideia de meter o nosso Bentinho no seminário? É mais que tempo, e já agora pode haver uma dificuldade.",
    ],
  },
  {
    id: "metamorfose",
    title: "A metamorfose",
    author: "Franz Kafka",
    color: "#b64b32",
    status: "reading",
    format: "PDF",
    page: 0,
    collections: ["literatura"],
    content: [
      "Uma manhã diferente\n\nEsta amostra apresenta A metamorfose, novela publicada por Franz Kafka em 1915. A história acompanha Gregor Samsa após um despertar que rompe a rotina de sua família.\n\nA obra permite pensar em trabalho, pertencimento e nas condições que impomos ao cuidado. O leitor acompanha uma transformação física, mas também a mudança dos vínculos ao redor do protagonista.\n\nEste texto de apresentação foi escrito para a biblioteca de exemplo. Importe sua edição para ler o livro completo.",
      "Para ler com atenção\n\nObserve quem conta a história e como os demais personagens reagem a Gregor. Quais hábitos permanecem quando tudo parece ter mudado?\n\nSelecione um trecho para criar um destaque, use a caneta para anotar ou registre uma ideia no painel lateral. Suas anotações ficam disponíveis na central de conhecimento.",
      "Depois da leitura\n\nQuais passagens mudaram sua interpretação da história? Voltar aos destaques pode revelar conexões que passaram despercebidas na primeira leitura.\n\nEsta é a última página da amostra. O arquivo completo pode ser importado pela biblioteca.",
    ],
  },
  {
    id: "meditacoes",
    title: "Meditações",
    author: "Marco Aurélio",
    color: "#b6a584",
    status: "reading",
    format: "EPUB",
    page: 0,
    collections: ["filosofia"],
    content: [
      "Um encontro com os próprios pensamentos\n\nMeditações reúne reflexões pessoais do imperador romano Marco Aurélio. Não foi concebido como um tratado para publicação: suas anotações registram um exercício contínuo de atenção à própria conduta.\n\nO livro convida a distinguir o que depende de nós do que escapa ao nosso controle. A leitura pode ser feita aos poucos, com tempo para relacionar cada reflexão à experiência cotidiana.\n\nApresentação original da biblioteca de exemplo. Importe sua edição para ler o texto integral.",
      "Ler e registrar\n\nUma anotação não precisa encerrar uma ideia. Ela pode guardar uma pergunta para outra leitura.\n\nExperimente escrever o que uma passagem desperta em você e retome essa nota em outro momento.",
    ],
  },
  {
    id: "desassossego",
    title: "Livro do desassossego",
    author: "Fernando Pessoa",
    color: "#e4dbc9",
    status: "want",
    format: "EPUB",
    page: 0,
    collections: ["literatura"],
    content: [
      "Uma leitura em fragmentos\n\nO Livro do desassossego é uma obra póstuma de Fernando Pessoa, associada a Bernardo Soares. Seus fragmentos exploram a experiência de observar a cidade, o cotidiano e a própria consciência.\n\nA forma fragmentária permite percursos diferentes. Não é necessário apressar a leitura: uma página pode acompanhar o leitor por um dia inteiro.\n\nApresentação original da biblioteca de exemplo. Importe sua edição para ler a obra.",
    ],
  },
  {
    id: "orgulho",
    title: "Orgulho e preconceito",
    author: "Jane Austen",
    color: "#727e64",
    status: "want",
    format: "EPUB",
    page: 0,
    collections: ["literatura"],
    content: [
      "Primeiras impressões\n\nPublicado em 1813, o romance de Jane Austen acompanha Elizabeth Bennet e sua família. Relações sociais, expectativas e julgamentos precipitados atravessam a narrativa.\n\nO título sugere duas forças que moldam a maneira de ver os outros. Ao longo da leitura, vale observar como as primeiras impressões se transformam.\n\nApresentação original da biblioteca de exemplo. Importe sua edição para ler o romance completo.",
    ],
  },
  {
    id: "frankenstein",
    title: "Frankenstein",
    author: "Mary Shelley",
    color: "#263c49",
    status: "want",
    format: "PDF",
    page: 0,
    collections: ["literatura"],
    content: [
      "Criação e responsabilidade\n\nO romance de Mary Shelley, publicado em 1818, coloca em discussão as responsabilidades de quem cria e as consequências do abandono.\n\nA narrativa se desenvolve em camadas, com relatos dentro de outros relatos. A mudança de perspectiva é parte essencial da leitura.\n\nApresentação original da biblioteca de exemplo. Importe sua edição para ler a obra completa.",
    ],
  },
  {
    id: "arte-guerra",
    title: "A arte da guerra",
    author: "Sun Tzu",
    color: "#9b3b32",
    status: "want",
    format: "TXT",
    page: 0,
    collections: ["filosofia"],
    content: [
      "Estratégia e contexto\n\nA arte da guerra é um tratado chinês tradicionalmente atribuído a Sun Tzu. Seus capítulos tratam de planejamento, informação, circunstâncias e decisão.\n\nPara uma leitura cuidadosa, considere o contexto militar do texto antes de transportar suas ideias para outras atividades.\n\nApresentação original da biblioteca de exemplo. Importe sua tradução para ler o livro completo.",
    ],
  },
  {
    id: "cortico",
    title: "O cortiço",
    author: "Aluísio Azevedo",
    color: "#c28849",
    status: "finished",
    format: "EPUB",
    page: 0,
    collections: ["literatura"],
    content: [
      "O cortiço\n\nEram cinco horas da manhã e o cortiço acordava, abrindo, não os olhos, mas a sua infinidade de portas e janelas alinhadas.\n\nUm acordar alegre e farto de quem dormiu de uma assentada sete horas de chumbo. Como que se sentiam ainda na indolência de neblina as derradeiras notas da última guitarra da noite antecedente, dissolvendo-se à luz loura e tenra da aurora, que nem um suspiro de saudade perdido em terra alheia.",
    ],
  },
] as const;

export function initialState(): LibraryState {
  const documents = books.map((book, i) => ({
    ...book,
    collections: [...book.collections],
    content: [...book.content],
    pages: book.content.length,
    cover: `/covers/${book.id}.svg`,
    progress:
      book.status === "finished"
        ? 100
        : book.status === "reading"
          ? [38, 16, 24][i]
          : 0,
    size: 0,
    demo: true,
    addedAt: new Date(Date.UTC(2026, 10, 10 - i)).toISOString(),
    lastReadAt:
      book.status === "reading"
        ? new Date(Date.UTC(2026, 10, 14, 20 - i)).toISOString()
        : undefined,
  })) as ReaderDocument[];
  return {
    documents,
    collections: [
      { id: "literatura", name: "Literatura", color: "#819275" },
      { id: "filosofia", name: "Filosofia & ideias", color: "#b39470" },
    ],
    annotations: [],
    bookmarks: [],
    readingSeconds: 0,
    preferences: {
      theme: "light",
      fontSize: 19,
      readerTheme: "paper",
      dailyGoal: 20,
    },
  };
}
