// The journey: each chapter reconstructs a real discovery — the problem on the
// desk, the prevailing (painful) approach, and the leap. Read it as a story you
// could have lived. Content is historically faithful; equations are simplified
// to the load-bearing idea, not the full paper.

const LESSONS = [
  {
    year: "1950s",
    title: "Meaning is company",
    people: "J.R. Firth · Zellig Harris",
    body: [
      { p: "You want a machine to understand language. First question, and it's a wall: <em>what is the meaning of a word, in a form a machine could hold?</em> A dictionary defines words with more words — circular. Meaning seems to live in human heads, not on paper.", lead: true },
      { desk: "How do you represent <em>meaning</em> as something mechanical — countable, comparable — without a human in the loop?" },
      { p: "The linguists' escape was to stop asking what a word <em>means</em> and ask where it <em>appears</em>. Harris's <strong>distributional hypothesis</strong>: words used in the same contexts tend to have similar meanings. Firth's slogan made it famous:" },
      { eq: '"You shall know a word by the company it keeps." — Firth, 1957' },
      { leap: "Meaning need not be defined — it can be <em>observed</em>. If <code>dog</code> and <code>cat</code> show up near the same words (<code>feed</code>, <code>vet</code>, <code>pet</code>), the data alone says they're related. No semantics required, just statistics of context." },
      { p: "This is the seed of <strong>everything</strong> that follows — word2vec, BERT, the embeddings powering search today. Sixty years before they existed, the bet was placed: <em>meaning = patterns of co-occurrence</em>." },
      { legacy: "Every embedding model you'll meet is a machine for cashing out this one sentence. They differ only in how cleverly they count the company a word keeps." },
    ],
    quiz: [
      { q: "The distributional hypothesis says a word's meaning can be approximated by…", options: ["its dictionary definition", "the contexts/words it co-occurs with", "the number of letters it has", "how often a human rates it"], answer: 1, explain: "Harris & Firth: meaning ≈ distribution over contexts. <b>This is the foundation of all embeddings.</b>" },
      { q: "Why was this a breakthrough for <i>machines</i> specifically?", options: ["It made dictionaries shorter", "It turned meaning into something countable from raw text", "It required human labeling", "It only worked for English"], answer: 1, explain: "Context co-occurrence is <b>observable statistics</b> — a machine can count it without anyone defining meaning." },
    ],
  },

  {
    year: "1990",
    title: "The first vectors",
    people: "Deerwester, Dumais, Landauer et al. — Latent Semantic Analysis",
    body: [
      { p: "Fast-forward to information retrieval. You're building search. A user types <code>car</code>; a perfect document says <code>automobile</code> and never once says <code>car</code>. Keyword matching returns nothing. This is the <strong>synonymy problem</strong>, and it's killing recall.", lead: true },
      { desk: "Keyword search is literal. <code>car</code> ≠ <code>automobile</code> to a string matcher, even though they mean the same thing. How do you match on <em>meaning</em>?" },
      { p: "LSA takes Firth literally and builds the <strong>term–document matrix</strong>: rows = words, columns = documents, each cell = does this word appear here. Now every word is a row vector of which documents it lives in — its 'company,' as numbers." },
      { p: "But the matrix is huge and noisy. The trick: <strong>SVD</strong> (singular value decomposition) compresses it to a few hundred latent dimensions. Words that co-occur with similar documents collapse toward the <em>same direction</em> in this smaller space. <code>car</code> and <code>automobile</code>, never seen together, end up neighbors because they keep the same company." },

      { h: "SVD, the intuitive version: friend-of-a-friend" },
      { p: "A word is just <strong>one row of the table</strong> — the list of documents it shows up in. Tiny example:" },
      { eq: "            doc1  doc2  doc3  doc4\ncar           1     1     0     0\nautomobile    0     0     1     1\nwheel         1     1     1     1" },
      { p: "<code>car</code> = <code>[1,1,0,0]</code> and <code>automobile</code> = <code>[0,0,1,1]</code> <strong>never share a single document</strong>. Raw overlap is zero — keyword search thinks they're unrelated. But look: <em>both sit next to</em> <code>wheel</code> (and would sit next to <code>engine</code>, <code>road</code>…)." },
      { leap: "SVD does <strong>friend-of-a-friend</strong>: <em>you're similar to those who share your friends — even if you two have never met.</em> <code>car</code> and <code>automobile</code> never meet, but they keep all the same company (<code>wheel</code>, <code>engine</code>, <code>road</code>). SVD spots the shared friends and links them." },
      { p: "Concretely: SVD invents a few hidden <strong>themes</strong> (a 'vehicle' theme, a 'finance' theme…) and re-describes every word by <em>how much of each theme it has</em>, instead of <em>which raw documents</em>. Now <code>car</code> and <code>automobile</code> both score high on the vehicle theme → their vectors point the same way → cosine ≈ 1. <strong>Synonyms discovered, with zero direct overlap.</strong>" },
      { p: "<strong>Truncation</strong> = keep only the handful of strong themes and throw away the noise. The <em>k</em> you keep is how many themes you allow. Fewer themes = more aggressive 'these are basically the same' merging. (The <strong>Eckart–Young theorem</strong> guarantees this top-<code>k</code> keep is the mathematically best compression possible — but you don't need the proof to feel it.)" },
      { aside: "Optional, skip if it doesn't help: the formula is <code>A = U·Σ·Vᵀ</code>. Mechanically it's rotate→stretch→rotate, and the 'stretch amounts' (singular values, sorted big→small) measure how strong each theme is. That's just <em>how a computer finds the themes</em> — the friend-of-a-friend story above is the real meaning." },
      { p: '<a class="deepdive" href="../svd/">Go deeper → <b>SVD Explorer</b>: rotate·stretch·rotate, the circle→ellipse geometry, and image compression — the full intuition behind this one chapter.</a>' },

      { leap: "A word is now a <strong>point in space</strong>. Similar meaning ⇒ nearby points. 'Nearby' becomes math: the <em>angle</em> between two vectors. This is the birth of the embedding — and of <strong>cosine similarity</strong>, still the exact metric your code-search tool uses today." },
      { widget: "cosine" },
      { p: "Move the vectors above. Small angle ⇒ cosine near 1 ⇒ 'same meaning.' Ninety degrees ⇒ cosine 0 ⇒ unrelated. Every semantic search — including <code>vecs</code> — is this, in 384 dimensions instead of 2." },
      { legacy: "Vector embeddings are now ~35 years old. LSA had no neural net, no attention, no GPU — just counting and linear algebra. The <em>idea</em> of meaning-as-geometry was already complete in 1990." },
    ],
    quiz: [
      { q: "What problem did LSA primarily solve for search?", options: ["Spelling mistakes", "Synonymy — matching car↔automobile by meaning", "Slow disk reads", "Grammar checking"], answer: 1, explain: "SVD pulls synonyms into the same latent direction even when they never co-occur. <b>Meaning-as-geometry.</b>" },
      { q: "How does LSA decide two words are similar?", options: ["They share letters", "Their vectors point in a similar direction (small angle / high cosine)", "They appear in the same sentence", "A human tagged them"], answer: 1, explain: "Similarity = <b>cosine</b> between vectors. The same metric vecs uses today." },
      { q: "What math compressed the giant word×document matrix into dense vectors?", options: ["Backpropagation", "Singular Value Decomposition (SVD)", "Attention", "Gradient descent"], answer: 1, explain: "SVD — pure linear algebra, no learning. Embeddings predate neural training." },
      { q: "In <code>A = UΣVᵀ</code>, the singular values (diagonal of Σ) represent…", options: ["random seeds", "how much the data stretches along each axis — sorted big→small", "the number of documents", "rotation angles"], answer: 1, explain: "Σ holds the stretch amounts = ellipsoid axis lengths = energy per direction. <b>Sorted</b>, so you can keep the big ones." },
      { q: "Keeping only the top-k singular values gives you…", options: ["a random subset", "the provably best rank-k approximation (Eckart–Young) — denoised structure", "the original matrix, unchanged", "a larger matrix"], answer: 1, explain: "Eckart–Young: top-k is the <b>optimal</b> low-rank approximation. Truncation drops noise and forces synonyms to share topic-axes." },
    ],
  },

  {
    year: "2003",
    title: "Let the network learn the vectors",
    people: "Yoshua Bengio et al. — A Neural Probabilistic Language Model",
    body: [
      { p: "You want to predict the next word. The classic tool is the <strong>n-gram</strong>: count how often 'the cat sat on the' is followed by each word. It works — until it doesn't. Most 5-word sequences never appear in your data even once. The counts are zero. This is the <strong>curse of dimensionality</strong>.", lead: true },
      { desk: "n-grams memorize exact word sequences. They can't generalize: seeing 'the cat is walking' teaches them <em>nothing</em> about 'a dog was running,' even though it's the same shape of sentence." },
      { p: "Bengio's move: don't represent words as atomic symbols (indices in a vocabulary). Give each word a <strong>learned vector</strong>, and train a neural network to predict the next word from those vectors. Crucially — the vectors are <em>parameters</em>. Backprop shapes them." },
      { leap: "If <code>cat</code> and <code>dog</code> get similar vectors (because predicting their neighbors works better that way), then a sentence about cats <strong>automatically</strong> informs the model about dogs. The embedding is no longer counted — it's <em>learned</em>, as a side effect of doing a task." },

      { h: "“But LSA already grouped cat and dog — so what's actually new?”" },
      { p: "Fair challenge — and a sharp one. LSA's <em>counted</em> vectors already placed <code>cat</code> near <code>dog</code>. Bengio's leap is <strong>not</strong> the grouping. It's <strong>where the vector comes from.</strong>" },
      { p: "LSA <em>counts</em> a giant table once and factorizes it — a fixed, one-shot measurement. Bengio makes each vector a set of <strong>adjustable knobs</strong> that a neural network <em>tunes by trial and error</em> (gradient descent) to get better at a task. Same <code>cat≈dog</code> result; a completely different <em>kind of object</em>." },
      { leap: "Why that reframing is everything: a counted table is a dead artifact — a map drawn from a survey, finished. A <em>learned</em> vector is a <strong>living building block</strong> you can stack inside a bigger network and keep training. Embeddings stop being preprocessing and become the <strong>first layer of a trainable model</strong>. LSA could never be 'layer 1 of a deep net'; Bengio's could. <em>That</em> is the road to BERT and GPT." },
      { aside: "The analogy: LSA <strong>surveys the city and hands you a map</strong>. Bengio <strong>gives a robot a goal and lets it draw — and redraw — its own map</strong> that's good for the task. And you can bolt more robots on top." },
      { aside: "This is the template for the next 20 years: <em>pick a self-supervised prediction task, and useful representations fall out as a byproduct.</em> word2vec, BERT, GPT — all variations on this." },
      { legacy: "Bengio fused the two threads: distributional meaning (Firth) + neural learning. But it was slow and heavy for 2003 hardware. The world needed someone to make it cheap." },
    ],
    quiz: [
      { q: "What weakness of n-gram models did Bengio target?", options: ["They were too fast", "They couldn't generalize across similar words/sequences", "They used too little memory", "They needed GPUs"], answer: 1, explain: "n-grams memorize exact sequences; unseen ones get zero probability. Learned vectors let similar words <b>share statistical strength</b>." },
      { q: "The key idea that recurs for 20 years after this paper:", options: ["Bigger dictionaries", "Useful representations emerge as a byproduct of a prediction task", "Hand-labeling every word", "Faster string matching"], answer: 1, explain: "Self-supervised prediction → representations fall out for free. The spine of word2vec, BERT, and GPT." },
    ],
  },

  {
    year: "2013",
    title: "king − man + woman = queen",
    people: "Tomáš Mikolov et al. (Google) — word2vec",
    body: [
      { p: "Bengio's model worked but was expensive. Mikolov asked: how <em>simple</em> can we make this and still get great word vectors? He stripped the network almost to nothing.", lead: true },
      { desk: "Learned embeddings were powerful but slow to train. Could you get them cheaply enough to run on billions of words?" },
      { p: "<strong>Skip-gram</strong>: take a word, try to predict its neighbors. That's it — a shallow model, one projection layer, a clever sampling trick. It trained on billions of words fast, on CPUs." },
      { p: "Then came the result that stunned everyone. The vectors had <strong>linear structure</strong> — you could do <em>arithmetic</em> on meaning:" },
      { eq: "vec(king) − vec(man) + vec(woman) ≈ vec(queen)" },
      { leap: "Direction <em>means</em> something. The vector from <code>man</code> to <code>woman</code> is roughly the same as <code>king</code>→<code>queen</code>, <code>uncle</code>→<code>aunt</code>: a 'gender' direction. Nobody programmed this. It <strong>emerged</strong> from predicting neighbors. Geometry had learned analogy." },
      { aside: "This single demo lit the fuse on modern NLP. It made the abstract — 'meaning is geometry' — visceral. You could <em>add and subtract</em> concepts." },
      { legacy: "word2vec embeddings went everywhere. But they had a fatal limitation, and spotting it is the whole reason the next chapters exist…" },
    ],
    quiz: [
      { q: "word2vec's skip-gram trains by…", options: ["translating sentences", "predicting a word's surrounding neighbors", "labeling parts of speech", "compressing images"], answer: 1, explain: "Predict context from a word (skip-gram). Cheap, self-supervised, billions of words." },
      { q: "Why was <code>king − man + woman ≈ queen</code> so shocking?", options: ["It was hand-coded", "Analogical structure emerged unsupervised, as geometry", "It only worked once", "It required attention"], answer: 1, explain: "<b>Directions encode concepts</b> (gender, plurality…) with no one programming them. Emergent meaning-geometry." },
    ],
  },

  {
    year: "2013–17",
    title: "The flaw: one word, one vector",
    people: "The problem everyone now faced",
    body: [
      { p: "word2vec gives each word <strong>exactly one</strong> vector. Fixed. Forever. Now read these two sentences:", lead: true },
      { eq: "I sat on the river <b>bank</b>.\nI deposited cash at the <b>bank</b>." },
      { desk: "<code>bank</code> has one vector — but two unrelated meanings. A <em>static</em> embedding must average them into a meaningless blur. It literally cannot represent that <code>bank</code> means different things in different sentences." },
      { p: "This is the <strong>polysemy / context problem</strong>. Static embeddings are context-blind. They know a word's <em>average</em> company across all of English, but not what it means <em>right here, in this sentence</em>." },
      { leap: "The needed idea: an embedding should be a function of the <strong>whole sentence</strong>, not a lookup. <code>bank</code>'s vector should <em>change</em> depending on whether <code>river</code> or <code>cash</code> sits nearby. We need words to <em>read their neighbors</em> and update themselves." },
      { aside: "Hold that phrase — 'read their neighbors and update.' That is <strong>attention</strong>, three years early. The problem is now perfectly shaped for the solution." },
      { legacy: "Meanwhile, a totally separate field — machine translation — was about to invent exactly this mechanism for a totally different reason. They didn't know they were solving the embedding problem too." },
    ],
    quiz: [
      { q: "The core limitation of word2vec / static embeddings:", options: ["Too slow", "One fixed vector per word — blind to sentence context", "Needed GPUs", "Couldn't do arithmetic"], answer: 1, explain: "Static = context-blind. <code>bank</code> (river) and <code>bank</code> (money) collapse to one blurred vector." },
      { q: "What capability would fix it?", options: ["Bigger dictionaries", "Embeddings that change based on surrounding words", "Faster lookup tables", "More training epochs"], answer: 1, explain: "<b>Contextual</b> embeddings — a word reads its neighbors and updates. That's attention, foreshadowed." },
    ],
  },

  {
    year: "2014",
    title: "Attention is born (in translation)",
    people: "Bahdanau, Cho, Bengio — Neural Machine Translation by Jointly Learning to Align and Translate",
    body: [
      { p: "Different room, different problem. Neural translation used an <strong>encoder–decoder</strong>: an RNN reads the whole source sentence and crushes it into a <em>single fixed vector</em>; a second RNN expands that vector into the translation.", lead: true },
      { desk: "The entire source sentence — 5 words or 50 — must fit in <strong>one fixed-length vector</strong>. For long sentences this bottleneck strangles the model; by the time it finishes reading, the start has decayed away. Translation quality fell off a cliff with length." },
      { p: "Bahdanau's fix: stop forcing everything through one vector. Keep <strong>all</strong> the encoder's per-word states. When the decoder generates each output word, let it <em>look back</em> and decide which source words matter <strong>right now</strong> — and weight them." },
      { eq: "context = Σ  αᵢ · (source word i)\n        where  αᵢ = how much to attend to word i, and Σαᵢ = 1" },
      { leap: "Those weights <code>αᵢ</code> are <strong>attention</strong>. To translate 'bank' the decoder learns to put weight on the source words that disambiguate it. The model learns <em>where to look</em> — a soft, differentiable, learned alignment. The bottleneck is gone." },
      { widget: "attention" },
      { aside: "Notice: this is the <em>exact</em> 'read your neighbors and weight them' operation the embedding problem was begging for in the last chapter. Two fields, one mechanism — they just didn't know it yet." },
      { legacy: "Attention spread fast as an <em>add-on</em> to RNNs. For three years the recipe was 'RNN + attention.' Everyone assumed you still needed the RNN to handle sequence. Everyone was wrong." },
    ],
    quiz: [
      { q: "What bottleneck did Bahdanau attention remove?", options: ["Slow disk I/O", "Cramming the whole source sentence into one fixed vector", "Too many GPUs", "Spelling errors"], answer: 1, explain: "The single fixed-length context vector strangled long sentences. Attention lets the decoder read all source states selectively." },
      { q: "What are the attention weights αᵢ?", options: ["Random noise", "Learned amounts of how much to focus on each input element", "Word frequencies", "Fixed constants"], answer: 1, explain: "Soft, learned, differentiable focus — they sum to 1 and say <b>where to look</b> for each output step." },
      { q: "Attention was originally invented for…", options: ["Image classification", "Machine translation", "Speech synthesis", "Search ranking"], answer: 1, explain: "2014, NMT. It was an add-on to RNN encoder–decoders — not yet a standalone architecture." },
    ],
  },

  {
    year: "2017",
    title: "Attention is all you need",
    people: "Vaswani et al. (Google) — the Transformer",
    body: [
      { p: "RNNs had a second, deeper problem: they're <strong>sequential</strong>. Word 50 can't be processed until words 1–49 are done. On modern GPUs — which crave parallelism — that's torture. And long-range dependencies still decayed through the chain.", lead: true },
      { desk: "RNN + attention worked, but the RNN forced sequential computation (slow, unparallelizable) and still struggled to connect distant words. What if the RNN was the <em>problem</em>, not the scaffold?" },
      { p: "The audacious bet, right there in the title: <strong>throw the RNN away entirely.</strong> Keep only attention. Let every word attend to <em>every other word directly</em>, in parallel, in one step. They called it <strong>self-attention</strong>." },
      { p: "The machinery is three projections of each word — <strong>Query, Key, Value</strong>. A word's Query is matched against every word's Key to get attention weights; those weights pull a blend of Values:" },
      { eq: "Attention(Q,K,V) = softmax( Q·Kᵀ / √d ) · V" },
      { leap: "Now <code>bank</code> emits a Query like 'what disambiguates me?', matches strongly on the Keys of <code>river</code> or <code>cash</code>, and pulls their Values into its own representation. <strong>The word literally rewrites itself from its neighbors</strong> — fully parallel, any distance, one hop. This is the contextual embedding the 2014 chapter demanded, finally built clean." },
      { aside: "Same operation, both problems solved at once: translation's bottleneck <em>and</em> the static-embedding curse. 'Read your neighbors and update' became the whole architecture." },
      { legacy: "The Transformer is the substrate of <strong>all</strong> of it now — BERT, GPT, Claude, and the MiniLM model your <code>vecs</code> tool loads to embed code. Every modern embedding is a pooled stack of self-attention." },
    ],
    quiz: [
      { q: "What did 'Attention Is All You Need' remove?", options: ["Attention", "The recurrent network (RNN) — keeping only attention", "Embeddings", "Softmax"], answer: 1, explain: "The flex of the title: attention already existed (2014); they proved you could <b>delete the RNN</b> and keep only attention." },
      { q: "In self-attention, a word incorporates context by…", options: ["Looking it up in a dictionary", "Matching its Query against all Keys, then blending the Values", "Averaging all words equally", "Ignoring distant words"], answer: 1, explain: "Q·Kᵀ → softmax weights → weighted sum of V. The word rewrites itself from relevant neighbors, in parallel." },
      { q: "Why was killing the RNN a big deal for hardware?", options: ["RNNs used too much RAM", "Self-attention is parallel; RNNs force sequential processing", "GPUs hate softmax", "It reduced accuracy"], answer: 1, explain: "Parallelism. Every position attends at once → GPUs go brr → train on far more data." },
    ],
  },

  {
    year: "2018",
    title: "BERT: context, finally",
    people: "Devlin et al. (Google) — BERT",
    body: [
      { p: "Now take the Transformer encoder and aim it straight at the embedding problem. BERT's training task: hide ~15% of the words and make the model <strong>predict the missing ones from both sides</strong> (masked language modeling).", lead: true },
      { desk: "We have self-attention, but how do we train it to produce great <em>general-purpose</em> contextual embeddings, not just translations?" },
      { leap: "To fill in a blank, a word's representation must absorb its <strong>entire bidirectional context</strong>. After training, <code>bank</code> in 'river bank' and <code>bank</code> in 'cash bank' come out as <strong>different vectors</strong> — the polysemy curse from the 2013 chapter is finally broken. Embeddings are contextual." },
      { aside: "word2vec: one vector per word. BERT: one vector per word <em>per sentence</em>. The lookup table became a function." },
      { legacy: "BERT crushed benchmarks and made contextual embeddings the default. But there was a catch for <em>similarity</em> tasks specifically — and fixing it is what makes your code search possible." },
    ],
    quiz: [
      { q: "BERT's training trick (masked language modeling) forces each word to…", options: ["Memorize the dictionary", "Absorb its full left+right context to predict masked words", "Ignore context", "Translate to French"], answer: 1, explain: "Predicting a blank from both sides ⇒ representations must encode bidirectional context ⇒ <b>contextual embeddings</b>." },
      { q: "How does BERT beat word2vec's polysemy flaw?", options: ["Bigger vocabulary", "It outputs a different vector for a word depending on its sentence", "It uses cosine", "It runs faster"], answer: 1, explain: "One vector per word <i>per context</i>. 'river bank' ≠ 'cash bank' anymore." },
    ],
  },

  {
    year: "2019 → today",
    title: "Sentence vectors — and your search bar",
    people: "Reimers & Gurevych — Sentence-BERT · then the embedding-model era",
    body: [
      { p: "BERT embeds <em>words in context</em>, but search needs a single vector for a whole <strong>sentence or document</strong> — and BERT was painfully slow at comparing pairs (you'd have to re-run it on every pair). Useless at the scale of a codebase.", lead: true },
      { desk: "How do you get <em>one</em> good vector per sentence/chunk, fast enough to index millions and compare by cosine?" },
      { leap: "Sentence-BERT trains BERT with a <strong>siamese / contrastive</strong> objective: push similar texts' vectors together, dissimilar ones apart, then mean-pool into a single fixed vector. Now a sentence is <em>one</em> point in space — and similarity is back to a plain cosine, like LSA in 1990, but vastly smarter." },
      { p: "This is the lineage that ends at your terminal. <code>all-MiniLM-L6-v2</code> — the model <code>vecs</code> downloads — is a small, distilled, contrastively-trained Sentence-BERT. Six self-attention layers, 384-dim output, mean-pooled, unit-normalized." },
      { eq: "your query ─▶ [6× self-attention] ─▶ mean-pool ─▶ 384-d vector\n                                              │\n   code chunk ─▶ [same model] ─▶ 384-d vector ┘\n                       similarity = cosine(query, chunk)" },
      { leap: "Trace it: <strong>Firth's 'company a word keeps' (1957) → LSA's geometry (1990) → Bengio's learned vectors (2003) → word2vec's arithmetic (2013) → Bahdanau's attention (2014) → the Transformer (2017) → BERT's context (2018) → sentence vectors (2019)</strong> — all of it fires every time you run <code>vecs search</code>." },
      { legacy: "You now hold the embedding thread end to end. But the Transformer had a <strong>second door</strong> we never opened — the one marked <em>generate</em>. Walk through it and you arrive at GPT and Claude. Keep going. →" },
    ],
    quiz: [
      { q: "Why couldn't plain BERT be used directly for large-scale similarity search?", options: ["It had no attention", "Comparing pairs was far too slow and it gave no single sentence vector", "It only knew French", "It used word2vec"], answer: 1, explain: "BERT scores pairs (rerun per pair) and has no native sentence vector. Sentence-BERT fixes both with contrastive training + pooling." },
      { q: "<code>all-MiniLM-L6-v2</code> (what vecs uses) is fundamentally…", options: ["A keyword matcher", "A small distilled Sentence-BERT: stacked self-attention, mean-pooled to one vector", "A word2vec lookup", "An n-gram counter"], answer: 1, explain: "Transformer encoder (6 layers) + mean-pool + contrastive training → 384-d sentence embedding. The whole history, in one download." },
      { q: "Which metric ties 1990 LSA to 2024 code search?", options: ["Edit distance", "Cosine similarity between vectors", "BLEU score", "Word count"], answer: 1, explain: "Cosine. Meaning-as-geometry never left — the vectors just got dramatically better." },
    ],
  },

  {
    year: "2017, the other door",
    title: "The Transformer's two twins",
    people: "Encoder vs Decoder — one architecture, two jobs",
    body: [
      { p: "Everything so far walked <strong>one</strong> road: take text, <em>understand</em> it, output a vector. That's the <strong>encoder</strong> — BERT's branch. But the original Transformer paper had <em>two</em> halves, and we only opened one.", lead: true },
      { desk: "An encoder reads a whole sentence at once and outputs <em>understanding</em> (vectors). But how do you make a Transformer <strong>write</strong> — produce new text, word by word?" },
      { p: "That's the <strong>decoder</strong>. Same self-attention machinery you already learned — Q/K/V, the works — but aimed at a different job: <em>generate the next word</em>, then the next, then the next." },
      { eq: "ENCODER (BERT)         DECODER (GPT)\nreads all at once      writes left → right\nbidirectional          one word at a time\noutputs: understanding outputs: text\n→ embeddings, search   → ChatGPT, Claude" },
      { leap: "An LLM is <strong>not a new kind of beast.</strong> It's the Transformer's other twin — the decoder — pointed at generation. The attention you learned in 2014/2017 <em>is</em> the engine inside GPT. You already know its guts; we just need to see how generation works." },
      { legacy: "From here, the whole field develops one obsession: <strong>get freakishly good at predicting the next word.</strong>" },
    ],
    quiz: [
      { q: "The embedding/understanding road we walked used which half of the Transformer?", options: ["The decoder", "The encoder", "Neither", "Both equally"], answer: 1, explain: "Encoder = read & understand → vectors (BERT). LLMs take the <b>other</b> door: the decoder." },
      { q: "An LLM (GPT) is best described as…", options: ["A totally new architecture unrelated to embeddings", "The Transformer's decoder twin, aimed at generating text", "A bigger word2vec", "An SVD of the internet"], answer: 1, explain: "Same self-attention DNA you learned — just pointed at <b>writing</b> instead of understanding." },
    ],
  },

  {
    year: "2018–20",
    title: "Predict the next token. Forever.",
    people: "GPT — the autoregressive idea",
    body: [
      { p: "How do you train a network to <em>write</em>? The task is almost insultingly simple: <strong>given the text so far, predict the next word.</strong> That's the entire training objective.", lead: true },
      { desk: "Writing seems to need creativity, planning, knowledge. How do you turn that into a trainable task with a clear right answer?" },
      { p: "The trick: the internet <em>is</em> the answer key. Take any sentence, hide the next word, make the model guess it, check against the real word, nudge. No human labeling — the text labels itself. This is <strong>self-supervised</strong>, same spirit as every chapter since Bengio." },
      { p: "One rule keeps it honest — <strong>causal (masked) attention</strong>: each word may only attend to words <em>before</em> it. It can't peek at the future it's supposed to predict. (Contrast BERT, which sees both sides — that's why BERT understands but doesn't generate.)" },
      { p: "And generation? Just run the prediction in a loop — <strong>autoregression</strong>:" },
      { eq: "predict next word  →  append it  →  feed the longer text back  →  predict again  →  …" },
      { widget: "autoregress" },
      { leap: "That's it. That's the whole engine. ChatGPT, Claude — at their core, predicting one token at a time, appending, repeating. 'Glorified autocomplete' is, mechanically, <em>true</em>." },
      { legacy: "Which raises the obvious objection: how could mere autocomplete be <strong>smart</strong>? The answer is the most surprising result in the field. Next chapter." },
    ],
    quiz: [
      { q: "An LLM's core training objective is…", options: ["Sort words alphabetically", "Predict the next token given the previous ones", "Translate to French", "Cluster documents"], answer: 1, explain: "Next-token prediction, self-supervised — the text is its own answer key." },
      { q: "Why does a generating LLM use <i>causal</i> (masked) attention?", options: ["To run faster", "So a token can't peek at the future words it must predict", "To save memory", "To handle images"], answer: 1, explain: "It may only attend to earlier tokens — otherwise predicting the next word would be cheating. BERT sees both sides; GPT only the past." },
      { q: "How does an LLM produce a whole sentence?", options: ["All words at once", "Autoregression: predict → append → feed back → repeat", "Looks it up in a table", "Runs SVD"], answer: 1, explain: "One token at a time, each feeding the next prediction. A loop." },
    ],
  },

  {
    year: "2020",
    title: "Just make it bigger",
    people: "GPT-2 → GPT-3 — scaling laws & emergence",
    body: [
      { p: "Early next-token models were mediocre. The team tried something almost lazy: don't change the recipe — just <strong>scale it</strong>. More parameters, more text, more compute. GPT-1 → GPT-2 → GPT-3 (175 <em>billion</em> parameters), same idea each time, much bigger.", lead: true },
      { desk: "Next-token prediction worked but felt dumb. Would a fundamentally simple objective ever produce something smart — or did we need a cleverer architecture?" },
      { p: "Turns out performance improves <strong>predictably</strong> with scale (the 'scaling laws'). But the shock was <strong>emergence</strong>: at large enough size, skills <em>nobody trained for</em> just appeared — translation, arithmetic, writing code, step-by-step reasoning." },
      { p: "Why? Think about what predicting the next token actually <em>requires</em>:" },
      { eq: "\"The capital of France is ___\"   → must know geography\n\"2 + 2 = ___\"                    → must do arithmetic\n\"def add(a, b): return ___\"      → must understand code\n\"She felt nervous because ___\"   → must model people" },
      { leap: "To predict the next word <em>well</em>, across the whole internet, the model is <strong>forced</strong> to build a working model of the world — facts, logic, syntax, even psychology. Intelligence isn't programmed in; it's the <em>cheapest way to compress text</em>. Understanding falls out as a side effect of getting really good at autocomplete." },
      { aside: "This is the deepest idea in the course: <strong>compression forces understanding.</strong> You saw the seed in SVD (squeeze the table → discover topics) and word2vec (squeeze prediction → discover analogy). Same principle, the whole way up." },
      { legacy: "Yet GPT-3, for all its power, still wasn't ChatGPT. Ask it a question and it might just… ask more questions. One final piece turns a raw predictor into an assistant." },
    ],
    quiz: [
      { q: "What was GPT-2→GPT-3's main change?", options: ["A brand-new architecture", "Mostly scale: more parameters, data, compute on the same recipe", "Switching to SVD", "Adding keyword search"], answer: 1, explain: "Same next-token Transformer, dramatically bigger. Scale itself was the lever." },
      { q: "'Emergence' here means…", options: ["The model crashed", "Skills nobody trained for (math, code, reasoning) appeared at scale", "It got slower", "It forgot words"], answer: 1, explain: "Unprogrammed abilities surface past a size threshold — a byproduct of predicting well." },
      { q: "Why does pure next-token prediction yield real knowledge?", options: ["It memorizes every sentence", "Predicting the next word well forces an internal model of facts/logic/the world", "It uses cosine similarity", "Humans label every answer"], answer: 1, explain: "<b>Compression forces understanding</b> — the same theme as SVD and word2vec, scaled to the internet." },
    ],
  },

  {
    year: "2022 → now",
    title: "From autocomplete to assistant",
    people: "InstructGPT / RLHF → ChatGPT, Claude",
    body: [
      { p: "Raw GPT-3 just <em>continues</em> text. Ask it 'What is the capital of France?' and it might reply 'What is the capital of Germany? What is the capital of Spain?' — faithfully continuing the <em>pattern</em> instead of answering. It's an autocomplete, not an assistant.", lead: true },
      { desk: "A giant next-token predictor knows a ton — but it doesn't <em>follow instructions</em> or stay helpful/honest. How do you steer it?" },
      { p: "<strong>Step 1 — Instruction tuning.</strong> Fine-tune on many <code>(instruction → good answer)</code> examples. This teaches the <em>format</em> of being helpful: when you see a question, answer it." },
      { p: "<strong>Step 2 — RLHF</strong> (reinforcement learning from human feedback). Show humans several model answers; they rank them best→worst. Train a <em>reward model</em> to predict those rankings, then optimize the LLM to score high. Now it's tuned toward what people actually <em>want</em> — helpful, honest, harmless." },
      { leap: "<strong>ChatGPT (Nov 2022) = a big next-token model + instruction tuning + RLHF.</strong> The engine didn't get smarter — it got <em>steered</em>. Same autocomplete underneath, now aimed at being a good assistant. Claude (what you're talking to) is this exact lineage, with heavy emphasis on the honest/harmless part." },
      { h: "You already know what's inside it" },
      { p: "Open up the LLM answering you right now and every part is a chapter you just walked:" },
      { eq: "first layer        →  a token EMBEDDING table      (Bengio '03, word2vec '13)\ncore operation     →  SELF-ATTENTION               (Bahdanau '14, Transformer '17)\ncontext handling   →  words rewrite from neighbors  (the 'bank' problem, BERT '18)\nhow it writes      →  next-token autoregression     (GPT)\nhow it's helpful   →  instruction tuning + RLHF      (ChatGPT '22)" },
      { legacy: "From Firth's 1957 sentence — <em>'know a word by the company it keeps'</em> — to the assistant in your browser, it's <strong>one</strong> idea, refined for 65 years: meaning lives in context, and if you build a machine to exploit that hard enough, understanding emerges. You've now walked the entire road. 🎉" },
    ],
    quiz: [
      { q: "Why isn't a raw pretrained LLM (like GPT-3) already a helpful assistant?", options: ["It's too small", "It only continues text patterns — it doesn't follow instructions or align to what users want", "It can't read", "It uses SVD"], answer: 1, explain: "Pretraining = next-token prediction. Following instructions & being helpful is added afterward." },
      { q: "What does RLHF do?", options: ["Makes the model bigger", "Uses human rankings to train a reward model, then steers the LLM toward preferred answers", "Counts word co-occurrences", "Translates text"], answer: 1, explain: "Reinforcement Learning from Human Feedback — aligns the model with human preferences (helpful/honest/harmless)." },
      { q: "The first layer of a modern LLM is fundamentally…", options: ["An SVD", "A token embedding table — the same idea from Bengio/word2vec", "A keyword index", "A reward model"], answer: 1, explain: "It starts by turning tokens into vectors — the very embeddings this whole course was about. The road is one continuous thread." },
    ],
  },
];
