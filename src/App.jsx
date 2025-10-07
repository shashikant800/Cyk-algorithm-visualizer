import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Code,
  Zap,
  CheckCircle,
  XCircle,
  ArrowRight,
  FileDown,
  Github,
} from "lucide-react";
import Tree from 'react-d3-tree';

export default function CYKAlgorithmApp() {
  const [activeTab, setActiveTab] = useState("CYK");
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [parsing, setParsing] = useState(false);

  // Simulator state (freeform textarea + word)
  const [simGrammarText, setSimGrammarText] = useState(
    "S -> AB | BC\nA -> BA | a\nB -> CC | b\nC -> AB | a"
  );
  const [simWord, setSimWord] = useState("ababa");

  // PGC custom grammar (default to provided NLP grammar)
  const [pgcGrammarText, setPgcGrammarText] = useState(
    'S -> NP VP\nNP -> Det N\nVP -> V NP\nDet -> "the" | "a"\nN -> "cat" | "dog"\nV -> "chased"'
  );
  const [pgcSentence, setPgcSentence] = useState('the cat chased a dog');

  // Grammar state for custom grammar
  const [customGrammar, setCustomGrammar] = useState({
    variables: "S,A,B",
    terminals: "a,b",
    startSymbol: "S",
    rules: "S->AB|BA\nA->a\nB->b",
  });

  // Predefined grammar for examples
  const exampleGrammar = {
    variables: ["S", "A", "B"],
    terminals: ["a", "b"],
    startSymbol: "S",
    rules: {
      S: [
        ["A", "B"],
        ["B", "A"],
      ],
      A: [["a"]],
      B: [["b"]],
    },
  };

  const parseGrammar = (grammarInput) => {
    const lines = grammarInput.rules.split("\n").filter((l) => l.trim());
    const parsedRules = {};

    lines.forEach((line) => {
      const [left, right] = line.split("->");
      const variable = left.trim();
      const productions = right.split("|").map((prod) =>
        prod
          .trim()
          .split("")
          .filter((c) => c.trim())
      );
      parsedRules[variable] = productions;
    });

    return {
      variables: grammarInput.variables.split(",").map((v) => v.trim()),
      terminals: grammarInput.terminals.split(",").map((t) => t.trim()),
      startSymbol: grammarInput.startSymbol.trim(),
      rules: parsedRules,
    };
  };

  // Parse textarea style grammar into CNF-like structure
  const parseGrammarFromText = (text) => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const rules = {};
    const variablesSet = new Set();
    const terminalsSet = new Set();
    let startSymbol = "S";

    lines.forEach((line, idx) => {
      const arrowIndex = line.indexOf("->");
      const altArrowIndex = arrowIndex === -1 ? line.indexOf("→") : arrowIndex;
      const splitter = altArrowIndex !== -1 ? altArrowIndex : -1;
      if (splitter === -1) return; // skip malformed lines
      const left = line.slice(0, splitter).trim().replace(/\s+/g, "");
      const right = line.slice(splitter + 2).trim();
      if (idx === 0 && left) startSymbol = left;
      if (!rules[left]) rules[left] = [];
      variablesSet.add(left);
      right
        .split("|")
        .map((p) => p.trim())
        .forEach((prod) => {
          // Support quoted terminals (multi-letter), and multi-letter variables split by spaces
          const trimmed = prod.trim();
          const quotedMatch = trimmed.match(/^"([^"]+)"$/);
          if (quotedMatch) {
            const token = quotedMatch[1];
            terminalsSet.add(token);
            rules[left].push([token]);
            return;
          }
          const parts = trimmed.split(/\s+/).filter(Boolean);
          if (parts.length === 1) {
            const sym = parts[0];
            if (/^[a-z]$/.test(sym)) {
              terminalsSet.add(sym);
              rules[left].push([sym]);
              return;
            }
            // Support compact uppercase pairs like AB -> split to A B
            if (/^[A-Z]{2}$/.test(sym)) {
              const B = sym[0];
              const C = sym[1];
              variablesSet.add(B);
              variablesSet.add(C);
              rules[left].push([B, C]);
              return;
            }
            // Single symbol variable (degenerate)
            variablesSet.add(sym);
            rules[left].push([sym]);
            return;
          }
          if (parts.length === 2) {
            const [B, C] = parts;
            variablesSet.add(B);
            variablesSet.add(C);
            rules[left].push([B, C]);
          }
        });
    });
    return {
      variables: Array.from(variablesSet),
      terminals: Array.from(terminalsSet),
      startSymbol,
      rules,
    };
  };

  // CYK for token arrays with backpointers for parse tree
  const cykWithPointers = (tokens, grammar) => {
    const n = tokens.length;
    if (n === 0) return { accepted: false, table: [], back: [] };
    const table = Array(n)
      .fill(null)
      .map(() => Array(n).fill(null).map(() => new Set()));
    const back = Array(n)
      .fill(null)
      .map(() => Array(n).fill(null).map(() => new Map()));

    // diagonal from terminals
    for (let i = 0; i < n; i++) {
      const tok = tokens[i];
      Object.keys(grammar.rules).forEach((A) => {
        grammar.rules[A].forEach((prod) => {
          if (prod.length === 1 && prod[0] === tok) {
            table[i][i].add(A);
            if (!back[i][i].has(A)) back[i][i].set(A, []);
            back[i][i].get(A).push({ type: 'terminal', token: tok });
          }
        });
      });
    }

    // upper triangle
    for (let len = 2; len <= n; len++) {
      for (let i = 0; i <= n - len; i++) {
        const j = i + len - 1;
        for (let k = i; k < j; k++) {
          Object.keys(grammar.rules).forEach((A) => {
            grammar.rules[A].forEach((prod) => {
              if (prod.length === 2) {
                const [B, C] = prod;
                if (table[i][k].has(B) && table[k + 1][j].has(C)) {
                  table[i][j].add(A);
                  if (!back[i][j].has(A)) back[i][j].set(A, []);
                  back[i][j].get(A).push({ type: 'binary', left: B, right: C, split: k });
                }
              }
            });
          });
        }
      }
    }

    return { accepted: table[0][n - 1].has(grammar.startSymbol), table, back };
  };

  const buildParseTree = (grammar, tokens, back) => {
    const n = tokens.length;
    const S = grammar.startSymbol;
    if (!n || !back || !back[0][n - 1].has(S)) return null;
    const choose = (A, i, j) => {
      const choices = back[i][j].get(A);
      if (!choices || choices.length === 0) return { label: A };
      const first = choices[0];
      if (first.type === 'terminal') return { label: A, child: { label: first.token } };
      const left = choose(first.left, i, first.split);
      const right = choose(first.right, first.split + 1, j);
      return { label: A, left, right };
    };
    return choose(S, 0, n - 1);
  };

  const renderAsciiTree = (node) => {
    if (!node) return '';
    const lines = [];
    const draw = (n, indent) => {
      if (!n) return;
      lines.push(`${' '.repeat(indent)}${n.label}`);
      if (n.child) {
        lines.push(`${' '.repeat(indent)}|`);
        lines.push(`${' '.repeat(indent)}${n.child.label}`);
        return;
      }
      if (n.left || n.right) {
        lines.push(`${' '.repeat(indent)}/ \\`);
        draw(n.left, indent + 0);
        draw(n.right, indent + 2);
      }
    };
    draw(node, 0);
    return lines.join('\n');
  };

  const toD3Tree = (node) => {
    if (!node) return null;
    if (node.child) {
      return { name: node.label, children: [{ name: node.child.label }] };
    }
    if (node.left || node.right) {
      return {
        name: node.label,
        children: [toD3Tree(node.left), toD3Tree(node.right)].filter(Boolean),
      };
    }
    return { name: node.label };
  };

  const cykAlgorithm = (word, grammar) => {
    const n = word.length;
    if (n === 0) return { accepted: false, table: [], steps: [] };

    const table = Array(n)
      .fill(null)
      .map(() =>
        Array(n)
          .fill(null)
          .map(() => new Set())
      );
    const steps = [];

    // Step 1: Fill diagonal with terminals
    for (let i = 0; i < n; i++) {
      const char = word[i];
      Object.keys(grammar.rules).forEach((variable) => {
        grammar.rules[variable].forEach((production) => {
          if (production.length === 1 && production[0] === char) {
            table[i][i].add(variable);
            steps.push(
              `Cell[${i}][${i}]: '${char}' can be derived from ${variable}`
            );
          }
        });
      });
    }

    // Step 2: Fill remaining cells
    for (let length = 2; length <= n; length++) {
      for (let i = 0; i <= n - length; i++) {
        const j = i + length - 1;

        for (let k = i; k < j; k++) {
          Object.keys(grammar.rules).forEach((variable) => {
            grammar.rules[variable].forEach((production) => {
              if (production.length === 2) {
                const [B, C] = production;
                if (table[i][k].has(B) && table[k + 1][j].has(C)) {
                  table[i][j].add(variable);
                  steps.push(
                    `Cell[${i}][${j}]: ${variable} → ${B}${C} (from [${i}][${k}] and [${
                      k + 1
                    }][${j}])`
                  );
                }
              }
            });
          });
        }
      }
    }

    const accepted = table[0][n - 1].has(grammar.startSymbol);
    return { accepted, table, steps };
  };

  const handleCheckGrammar = (useCustom = false) => {
    setParsing(true);
    setTimeout(() => {
      const grammar = useCustom ? parseGrammar(customGrammar) : exampleGrammar;
      const result = cykAlgorithm(input, grammar);
      setResult(result);
      setParsing(false);
    }, 300);
  };

  const renderTable = () => {
    if (!result || !result.table.length) return null;

    const n = result.table.length;
    return (
      <div className="overflow-x-auto mt-6">
        <div className="inline-block min-w-full">
          <table className="border-collapse border border-gray-300">
            <tbody>
              {[...Array(n)].map((_, row) => (
                <tr key={row}>
                  {[...Array(n)].map((_, col) => {
                    const cellContent =
                      col >= row
                        ? Array.from(result.table[row][col]).join(", ")
                        : "";
                    return (
                      <td
                        key={col}
                        className={`border border-gray-300 p-3 text-center min-w-16 ${
                          col < row ? "bg-gray-100" : "bg-white"
                        } ${
                          col >= row && result.table[row][col].size > 0
                            ? "bg-blue-50"
                            : ""
                        }`}
                      >
                        {cellContent || "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-sm text-gray-600">
            CYK Parsing Table (Lower triangular cells are unused)
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: "url('/bg.jpg')" }}
    >
      {/* Floating Download Button */}
      <a
        href="/presentation.pdf"
        download
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-white hover:bg-gray-100 text-gray-900 shadow-xl flex items-center justify-center border border-gray-300"
        aria-label="Download presentation PDF"
        title="Download presentation.pdf"
      >
        <FileDown className="h-6 w-6" />
      </a>

      {/* Floating GitHub Button */}
      <a
        href="https://github.com/shashikant800/Cyk-algorithm-visualizer"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-24 z-50 h-14 w-14 rounded-full bg-white hover:bg-gray-100 text-gray-900 shadow-xl flex items-center justify-center border border-gray-300"
        aria-label="Open project GitHub repository"
        title="View on GitHub"
      >
        <Github className="h-6 w-6" />
      </a>
      {/* Navbar */}
      <nav className="bg-white shadow-md border-b-2 border-blue-500">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src="/logo.png" alt="Logo" className="h-12 w-12" />
              <h1 className="text-sm font-serif text-blue-600">
                CYK & Personal Grammar Checker Simulator
              </h1>
            </div>
            <div className="flex items-center space-x-8">
              {["CYK", "Simulator", "PGC", "RBS", "Know", "About Us"].map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 font-serif text-lg tracking-wide transition-all ${
                      activeTab === tab
                        ? "border-b-3 border-blue-600 text-blue-600 font-semibold"
                        : "text-gray-600 hover:text-blue-500"
                    }`}
                  >
                    {tab}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="bg-black/30  w-full px-6 py-12">
        {activeTab === "CYK" && (
          <div className="grid lg:grid-cols-2 items-start gap-0 min-h-[calc(100vh-180px)]">
            {/* Left Hero Section */}
            <div className="flex items-center justify-center p-12 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-10 left-10 w-32 h-32 border-4 border-white rounded-full"></div>
                <div className="absolute bottom-20 right-20 w-48 h-48 border-4 border-white rounded-full"></div>
                <div className="absolute top-1/3 right-1/4 w-24 h-24 border-4 border-white transform rotate-45"></div>
              </div>
              <div className="relative z-10 text-center">
                {/* <h1 className="text-6xl font-serif mb-6 text-white leading-tight">
                  CYK Algorithm
                </h1>
                <p className="text-2xl text-blue-100 font-light tracking-wide">
                  Cocke-Younger-Kasami<br />Parsing Algorithm
                </p> */}

                {/* Personal Grammar Checker */}
                <div className="mt-10 bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-200 hover:shadow-2xl transition-shadow min-h-[360px]">
                  <div className="flex items-center mb-6">
                    <CheckCircle className="w-8 h-8 text-green-500 mr-3" />
                    <h2 className="text-2xl font-serif text-gray-800">
                      CYK Algorithm Simulator
                    </h2>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Test strings against a predefined grammar in Chomsky Normal
                    Form
                  </p>
                  <button
                    onClick={() => setActiveTab("Know")}
                    className="w-full mb-4 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
                  >
                    Know More
                  </button>
                  <button
                    onClick={() => setActiveTab("Simulator")}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
                  >
                    Try Example
                  </button>
                </div>
              </div>
            </div>

            {/* Right Controls Section */}
            <div className=" p-12 flex items-start justify-center">
              <div className="max-w-lg w-full space-y-8">
                {/* Custom Grammar Builder */}
                <div className="mt-10 bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-200 hover:shadow-2xl transition-shadow min-h-[360px]">
                  <div className="flex items-center mb-6">
                    <Code className="w-8 h-8 text-purple-500 mr-3" />
                    <h2 className="text-2xl font-serif text-gray-800">
                      Personal Grammar Checker
                    </h2>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Create your own context-free grammar and test strings
                    against it
                  </p>
                  <button
                    onClick={() => setActiveTab("Know")}
                    className="w-full mb-4 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
                  >
                    Know More
                  </button>
                  <button
                    onClick={() => setActiveTab("PGC")}
                    className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-md"
                  >
                    Try Example
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "PGC" && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-3xl font-serif mb-6 text-gray-800">
              Personal Grammar Checker (Custom CFG)
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Grammar (use quotes for multi-letter terminals)</label>
                <textarea
                  rows={10}
                  value={pgcGrammarText}
                  onChange={(e) => setPgcGrammarText(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                />
                {/* <p className="text-xs text-gray-500 mt-1">Default example provided from your screenshot.</p> */}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sentence</label>
                <input
                  type="text"
                  value={pgcSentence}
                  onChange={(e) => setPgcSentence(e.target.value)}
                  placeholder="e.g., the cat chased a dog"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    setParsing(true);
                    setTimeout(() => {
                      const g = parseGrammarFromText(pgcGrammarText);
                      const tokens = pgcSentence.trim().split(/\s+/);
                      const cr = cykWithPointers(tokens, g);
                      const tree = cr.accepted ? buildParseTree(g, tokens, cr.back) : null;
                      setResult({ accepted: cr.accepted, table: cr.table, steps: [], tree });
                      setParsing(false);
                    }, 50);
                  }}
                  disabled={!pgcSentence || parsing}
                  className="mt-4 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {parsing ? "Generating..." : "Generate Table & Parse Tree"}
                </button>
              </div>
            </div>

            {result && (
              <div className="mt-8 space-y-6">
                <div
                  className={`p-6 rounded-lg ${
                    result.accepted
                      ? "bg-green-50 border-2 border-green-300"
                      : "bg-red-50 border-2 border-red-300"
                  }`}
                >
                  <div className="flex items-center">
                    {result.accepted ? (
                      <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-600 mr-3" />
                    )}
                    <div>
                      <h3
                        className={`text-xl font-bold ${
                          result.accepted ? "text-green-900" : "text-red-900"
                        }`}
                      >
                        {result.accepted
                          ? "Sentence Accepted!"
                          : "Sentence Rejected"}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Render CYK table using existing renderer */}
                {renderTable()}

                {/* Parse tree if available */}
                {result.tree && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                    <h4 className="font-semibold text-gray-800 mb-3">Parse Tree</h4>
                    <div className="h-[420px] w-full bg-white rounded border">
                      <Tree
                        data={toD3Tree(result.tree)}
                        orientation="vertical"
                        translate={{ x: 300, y: 40 }}
                        pathFunc="elbow"
                        collapsible={false}
                        zoom={0.8}
                        styles={{
                          links: { stroke: '#94a3b8' },
                          nodes: {
                            node: { circle: { fill: '#2563eb' }, name: { fill: '#111827', fontSize: '12px' } },
                            leafNode: { circle: { fill: '#10b981' }, name: { fill: '#111827', fontSize: '12px' } }
                          }
                        }}
                      />
                    </div>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-gray-600">Show ASCII</summary>
                      <pre className="mt-2 text-xs leading-5 whitespace-pre overflow-x-auto">{renderAsciiTree(result.tree)}</pre>
                    </details>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "Simulator" && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl p-8 border-2 border-gray-200">
              <h2 className="text-3xl font-serif mb-6 text-gray-800">
                CYK Algorithm Simulator
              </h2>
              <div className="grid md:grid-cols-3 gap-6 items-start">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Grammar
                  </label>
                  <textarea
                    value={simGrammarText}
                    onChange={(e) => setSimGrammarText(e.target.value)}
                    rows={10}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-lg leading-7"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Word
                  </label>
                  <input
                    type="text"
                    value={simWord}
                    onChange={(e) => setSimWord(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg"
                  />
                  <button
                    onClick={() => {
                      setParsing(true);
                      setTimeout(() => {
                        const g = parseGrammarFromText(simGrammarText);
                        const tokens = simWord.includes(' ')
                          ? simWord.trim().split(/\s+/)
                          : simWord.trim().split('');
                        const cr = cykWithPointers(tokens, g);
                        const tree = cr.accepted ? buildParseTree(g, tokens, cr.back) : null;
                        setResult({ accepted: cr.accepted, table: cr.table, steps: [], tree });
                        setParsing(false);
                      }, 50);
                    }}
                    disabled={!simWord || parsing}
                    className="mt-6 w-full px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {parsing ? "Generating..." : "Generate Table"}
                  </button>
                  <p className="text-xs text-gray-500 mt-3">
                    Format: Lines like S -&gt; AB | BC or A -&gt; a
                  </p>
                </div>
              </div>

              {result && (
                <div className="mt-8">
                  <div
                    className={`p-6 rounded-lg ${
                      result.accepted
                        ? "bg-green-50 border-2 border-green-300"
                        : "bg-red-50 border-2 border-red-300"
                    }`}
                  >
                    <div className="flex items-center">
                      {result.accepted ? (
                        <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
                      ) : (
                        <XCircle className="w-8 h-8 text-red-600 mr-3" />
                      )}
                      <div>
                        <h3
                          className={`text-xl font-bold ${
                            result.accepted ? "text-green-900" : "text-red-900"
                          }`}
                        >
                          {result.accepted
                            ? "String Accepted!"
                            : "String Rejected"}
                        </h3>
                        <p className={result.accepted ? "text-green-700" : "text-red-700"}>
                          {result.accepted ? 'The input is derivable from the grammar.' : 'The input is not derivable from the grammar.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {renderTable()}

                  {result.tree && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                      <h4 className="font-semibold text-gray-800 mb-3">Parse Tree</h4>
                      <div className="h-[420px] w-full bg-white rounded border">
                        <Tree
                          data={toD3Tree(result.tree)}
                          orientation="vertical"
                          translate={{ x: 300, y: 40 }}
                          pathFunc="elbow"
                          collapsible={false}
                          zoom={0.8}
                          styles={{
                            links: { stroke: '#94a3b8' },
                            nodes: {
                              node: { circle: { fill: '#2563eb' }, name: { fill: '#111827', fontSize: '12px' } },
                              leafNode: { circle: { fill: '#10b981' }, name: { fill: '#111827', fontSize: '12px' } }
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* {activeTab === 'RBS' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-3xl font-serif mb-6 text-gray-800">Rule-Based System (Custom Grammar)</h2>
            
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Variables (comma-separated):
                </label>
                <input
                  type="text"
                  value={customGrammar.variables}
                  onChange={(e) => setCustomGrammar({...customGrammar, variables: e.target.value})}
                  placeholder="S,A,B"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Terminals (comma-separated):
                </label>
                <input
                  type="text"
                  value={customGrammar.terminals}
                  onChange={(e) => setCustomGrammar({...customGrammar, terminals: e.target.value})}
                  placeholder="a,b"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Start Symbol:
              </label>
              <input
                type="text"
                value={customGrammar.startSymbol}
                onChange={(e) => setCustomGrammar({...customGrammar, startSymbol: e.target.value})}
                placeholder="S"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Production Rules (one per line, use | for alternatives):
              </label>
              <textarea
                value={customGrammar.rules}
                onChange={(e) => setCustomGrammar({...customGrammar, rules: e.target.value})}
                placeholder="S->AB|BA&#10;A->a&#10;B->b"
                rows={6}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Format: Variable→Production|Alternative (e.g., S→AB|BA)</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Enter string to parse:
              </label>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g., ab"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              onClick={() => handleCheckGrammar(true)}
              disabled={!input || parsing}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {parsing ? 'Parsing...' : 'Parse String'}
            </button>

            {result && (
              <div className="mt-8 space-y-6">
                <div className={`p-6 rounded-lg ${result.accepted ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'}`}>
                  <div className="flex items-center">
                    {result.accepted ? (
                      <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-600 mr-3" />
                    )}
                    <div>
                      <h3 className={`text-xl font-bold ${result.accepted ? 'text-green-900' : 'text-red-900'}`}>
                        {result.accepted ? 'String Accepted!' : 'String Rejected'}
                      </h3>
                      <p className={result.accepted ? 'text-green-700' : 'text-red-700'}>
                        {result.accepted 
                          ? 'The string belongs to your custom grammar.'
                          : 'The string does not belong to your custom grammar.'}
                      </p>
                    </div>
                  </div>
                </div>

                {renderTable()}

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-3">Parsing Steps:</h4>
                  <div className="space-y-2 text-sm text-gray-700 max-h-64 overflow-y-auto">
                    {result.steps.map((step, idx) => (
                      <div key={idx} className="flex items-start">
                        <ArrowRight className="w-4 h-4 mr-2 mt-0.5 text-purple-500 flex-shrink-0" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )} */}

        {activeTab === "Know" && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center mb-6">
              <BookOpen className="w-10 h-10 text-blue-600 mr-4" />
              <h2 className="text-3xl font-serif text-gray-800">
                About CYK Algorithm
              </h2>
            </div>

            <div className="prose max-w-none space-y-6 text-gray-700">
              <section>
                <h3 className="text-2xl font-semibold text-gray-800 mb-3">
                  What is CYK?
                </h3>
                <p>
                  The Cocke-Younger-Kasami (CYK) algorithm is a parsing
                  algorithm for context-free grammars. It determines whether a
                  given string can be generated by a given grammar and, if so,
                  how it can be generated.
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-gray-800 mb-3">
                  How It Works
                </h3>
                <p>
                  The CYK algorithm uses dynamic programming and works bottom-up
                  to fill a parse table. It requires the grammar to be in
                  Chomsky Normal Form (CNF), where all production rules are
                  either:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>A → BC (two non-terminals)</li>
                  <li>A → a (single terminal)</li>
                </ul>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-gray-800 mb-3">
                  Algorithm Steps
                </h3>
                <ol className="list-decimal list-inside ml-4 space-y-3">
                  <li>
                    <strong>Initialize:</strong> Create a parse table of size
                    n×n where n is the length of the input string
                  </li>
                  <li>
                    <strong>Fill Diagonal:</strong> For each character in the
                    string, find which variables can produce it
                  </li>
                  <li>
                    <strong>Fill Upper Triangle:</strong> For substrings of
                    increasing length, check if they can be derived by combining
                    smaller substrings
                  </li>
                  <li>
                    <strong>Check Result:</strong> If the start symbol appears
                    in the top-right cell, the string is accepted
                  </li>
                </ol>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-gray-800 mb-3">
                  Complexity
                </h3>
                <p>
                  The CYK algorithm has a time complexity of O(n³·|G|) where n
                  is the length of the input string and |G| is the size of the
                  grammar. The space complexity is O(n²).
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-semibold text-gray-800 mb-3">
                  Applications
                </h3>
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>
                    Natural language processing and computational linguistics
                  </li>
                  <li>Compiler design and syntax analysis</li>
                  <li>RNA secondary structure prediction in bioinformatics</li>
                  <li>Pattern matching in formal language theory</li>
                </ul>
              </section>

              <div className="mt-8 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">
                  Example Grammar (CNF):
                </h4>
                <div className="font-mono text-sm text-blue-800 space-y-1">
                  <div>S → AB | BA</div>
                  <div>A → a</div>
                  <div>B → b</div>
                </div>
                <p className="mt-3 text-blue-800 text-sm">
                  This grammar accepts strings like "ab" and "ba" but rejects
                  "aa", "bb", or "aba".
                </p>
              </div>

              {/* Personal Grammar Checker explanation + examples */}
              <section className="mt-10">
                <h3 className="text-2xl font-semibold text-gray-800 mb-3">
                  Personal Grammar Checker (with Examples)
                </h3>
                <p className="text-gray-700 mb-4">
                  Use the Personal Grammar Checker to test any CNF-style grammar you
                  provide. Enter production rules in the form "S -&gt; AB | a" and a
                  word, then generate the CYK table to see how the string is parsed.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b font-semibold text-gray-800">
                      Sample Grammar (as in the Simulator)
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="px-4 py-2 border-b">Variable</th>
                          <th className="px-4 py-2 border-b">Productions</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-800">
                        <tr>
                          <td className="px-4 py-2 border-b align-top">S</td>
                          <td className="px-4 py-2 border-b">AB | BC</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 border-b align-top">A</td>
                          <td className="px-4 py-2 border-b">BA | a</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 border-b align-top">B</td>
                          <td className="px-4 py-2 border-b">CC | b</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 align-top">C</td>
                          <td className="px-4 py-2">AB | a</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="px-4 py-2 text-xs text-gray-500 border-t">
                      Tip: Variables are uppercase (A–Z), terminals are lowercase (a–z).
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b font-semibold text-gray-800">
                      Example Strings to Try
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="px-4 py-2 border-b">String</th>
                          <th className="px-4 py-2 border-b">What to Observe</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-800">
                        <tr>
                          <td className="px-4 py-2 border-b">a</td>
                          <td className="px-4 py-2 border-b">Diagonal cells fill from terminal rules (e.g., A → a)</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 border-b">ab</td>
                          <td className="px-4 py-2 border-b">Top-right cell shows if S derives the whole string</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 border-b">aba</td>
                          <td className="px-4 py-2 border-b">Check splits k to see combining variables</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2">ababa</td>
                          <td className="px-4 py-2">Larger tables reveal derivations across multiple splits</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="px-4 py-2 text-xs text-gray-500 border-t">
                      Use the Simulator tab to generate the full table and acceptance result.
                    </div>
                  </div>
                </div>

                {/* How to use */}
                <div className="mt-8 grid md:grid-cols-3 gap-6">
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <h4 className="font-semibold text-gray-800 mb-2">1) Format</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      <li>Each rule on a new line, e.g., <span className="font-mono">S -&gt; AB | a</span></li>
                      <li>CNF only: <span className="font-mono">A -&gt; BC</span> or <span className="font-mono">A -&gt; a</span></li>
                      <li>Uppercase = variables, lowercase = terminals</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <h4 className="font-semibold text-gray-800 mb-2">2) Input</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      <li>Type the word using terminals only, e.g., <span className="font-mono">ababa</span></li>
                      <li>Click <span className="font-semibold">Generate Table</span></li>
                    </ul>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <h4 className="font-semibold text-gray-800 mb-2">3) Result</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      <li>Diagonal cells come from terminal rules</li>
                      <li>Upper cells combine using binary rules</li>
                      <li>Accepted if start symbol appears in top-right cell</li>
                    </ul>
                  </div>
                </div>

                {/* Worked examples */}
                <div className="mt-10">
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Worked Examples</h4>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Example 1 */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="px-4 py-3 bg-green-50 border-b font-semibold text-gray-800">
                        Example A: Grammar S → AB | BA, A → a, B → b; Word = "ab"
                      </div>
                      <div className="p-4 text-sm text-gray-700">
                        <div className="mb-3 font-semibold">CYK Table (n = 2)</div>
                        <table className="w-full text-center border-collapse">
                          <tbody>
                            <tr>
                              <td className="border px-3 py-2 bg-blue-50">S</td>
                              <td className="border px-3 py-2">—</td>
                            </tr>
                            <tr>
                              <td className="border px-3 py-2">A</td>
                              <td className="border px-3 py-2">B</td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="mt-2 text-xs text-gray-600">Top-right cell has S ⇒ accepted.</div>
                      </div>
                    </div>

                    {/* Example 2 */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="px-4 py-3 bg-red-50 border-b font-semibold text-gray-800">
                        Example B: Same Grammar; Word = "aa"
                      </div>
                      <div className="p-4 text-sm text-gray-700">
                        <div className="mb-3 font-semibold">CYK Table (n = 2)</div>
                        <table className="w-full text-center border-collapse">
                          <tbody>
                            <tr>
                              <td className="border px-3 py-2">—</td>
                              <td className="border px-3 py-2">—</td>
                            </tr>
                            <tr>
                              <td className="border px-3 py-2">A</td>
                              <td className="border px-3 py-2">A</td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="mt-2 text-xs text-gray-600">No S in top-right ⇒ rejected.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Natural language examples from screenshots */}
                <div className="mt-10">
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Natural Language Examples</h4>
                  <div className="grid lg:grid-cols-2 gap-8">
                    {/* Example: the cat chased a dog */}
                    <div className="border rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 bg-gray-50 border-b">
                        <div className="text-lg font-semibold text-gray-800">Valid sentence: "the cat chased a dog"</div>
                        <div className="text-sm text-gray-600">CFG and CYK table illustration</div>
                      </div>
                      <div className="p-5 grid md:grid-cols-5 gap-4 items-start">
                        <div className="md:col-span-2">
                          <div className="border rounded-lg p-4">
                            <div className="font-semibold text-gray-800 mb-2">Grammar (CFG)</div>
                            <div className="font-mono text-sm text-gray-800 space-y-1">
                              <div>S → NP VP</div>
                              <div>NP → Det N</div>
                              <div>VP → V NP</div>
                              <div>Det → "the" | "a"</div>
                              <div>N → "cat" | "dog"</div>
                              <div>V → "chased"</div>
                            </div>
                          </div>
                        </div>
                        <div className="md:col-span-3">
                          <div className="font-semibold text-gray-800 mb-2">CYK Table (schematic)</div>
                          <table className="w-full text-center border-collapse text-sm">
                            <thead>
                              <tr className="bg-gray-100 text-gray-700">
                                <th className="border px-2 py-1">word</th>
                                <th className="border px-2 py-1">col1</th>
                                <th className="border px-2 py-1">col2</th>
                                <th className="border px-2 py-1">col3</th>
                                <th className="border px-2 py-1">col4</th>
                                <th className="border px-2 py-1">col5</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="border px-2 py-1">the</td>
                                <td className="border px-2 py-1">Det</td>
                                <td className="border px-2 py-1">NP</td>
                                <td className="border px-2 py-1">–</td>
                                <td className="border px-2 py-1">–</td>
                                <td className="border px-2 py-1">S</td>
                              </tr>
                              <tr>
                                <td className="border px-2 py-1">cat</td>
                                <td className="border px-2 py-1">N</td>
                                <td className="border px-2 py-1">–</td>
                                <td className="border px-2 py-1">–</td>
                                <td className="border px-2 py-1">–</td>
                                <td className="border px-2 py-1">–</td>
                              </tr>
                              <tr>
                                <td className="border px-2 py-1">chased</td>
                                <td className="border px-2 py-1">V</td>
                                <td className="border px-2 py-1">–</td>
                                <td className="border px-2 py-1">VP</td>
                                <td className="border px-2 py-1">–</td>
                                <td className="border px-2 py-1">–</td>
                              </tr>
                              <tr>
                                <td className="border px-2 py-1">a</td>
                                <td className="border px-2 py-1">Det</td>
                                <td className="border px-2 py-1">NP</td>
                                <td className="border px-2 py-1">–</td>
                                <td className="border px-2 py-1">–</td>
                                <td className="border px-2 py-1">–</td>
                              </tr>
                              <tr>
                                <td className="border px-2 py-1">dog</td>
                                <td className="border px-2 py-1">N</td>
                                <td className="border px-2 py-1">–</td>
                                <td className="border px-2 py-1">–</td>
                                <td className="border px-2 py-1">–</td>
                                <td className="border px-2 py-1">–</td>
                              </tr>
                            </tbody>
                          </table>
                          <div className="mt-3 text-xs text-gray-600">Top-right shows S ⇒ valid parse.</div>
                        </div>
                      </div>
                      <div className="px-5 pb-5">
                        <div className="font-semibold text-gray-800 mb-2">Parse Tree (ASCII)</div>
                        <pre className="bg-gray-50 border rounded p-3 text-xs leading-5 overflow-x-auto">{`S
/ \
NP  VP
/\  / \
Det N V  NP
the cat  chased  / \
              Det  N
               a  dog`}</pre>
                      </div>
                    </div>

                    {/* Example: The dog ran. */}
                    <div className="border rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 bg-gray-50 border-b">
                        <div className="text-lg font-semibold text-gray-800">"The dog ran."</div>
                        <div className="text-sm text-gray-600">CYK table and parse tree</div>
                      </div>
                      <div className="p-5 grid md:grid-cols-2 gap-6 items-start">
                        <div>
                          <div className="font-semibold text-gray-800 mb-2">CYK Table (n = 3)</div>
                          <table className="w-full text-center border-collapse text-sm">
                            <thead>
                              <tr className="bg-gray-100 text-gray-700">
                                <th className="border px-3 py-1">Word</th>
                                <th className="border px-3 py-1">Column 1</th>
                                <th className="border px-3 py-1">Column 2</th>
                                <th className="border px-3 py-1">Column 3</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="border px-3 py-2">the</td>
                                <td className="border px-3 py-2">Det</td>
                                <td className="border px-3 py-2">NP</td>
                                <td className="border px-3 py-2">S</td>
                              </tr>
                              <tr>
                                <td className="border px-3 py-2">dog</td>
                                <td className="border px-3 py-2">N</td>
                                <td className="border px-3 py-2">–</td>
                                <td className="border px-3 py-2">–</td>
                              </tr>
                              <tr>
                                <td className="border px-3 py-2">ran</td>
                                <td className="border px-3 py-2">V</td>
                                <td className="border px-3 py-2">–</td>
                                <td className="border px-3 py-2">–</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 mb-2">Parse Tree (ASCII)</div>
                          <pre className="bg-gray-50 border rounded p-3 text-xs leading-5 overflow-x-auto">{`S
/ \
NP  VP
/\   |
Det N  V
 |  |  |
the dog ran`}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "About Us" && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center mb-8">
              <BookOpen className="w-10 h-10 text-blue-600 mr-4" />
              <h2 className="text-3xl font-serif text-gray-800">About Us</h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Saloni Kumari */}
              <div className="text-center">
                <div className="mb-4">
                  <img
                    src="/saloni.jpg"
                    alt="Saloni Kumari"
                    className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-blue-200 shadow-lg"
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Saloni Kumari
                </h3>
                <p className="text-gray-600">22/11/EC/009</p>
              </div>
              {/* Shashi Kant */}
              <div className="text-center">
                <div className="mb-4">
                  <img
                    src="/shashi.jpg"
                    alt="Shashi Kant"
                    className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-blue-200 shadow-lg"
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Shashi Kant
                </h3>
                <p className="text-gray-600">22/11/EC/041</p>
              </div>
              {/* Divyanshi Singh */}
              <div className="text-center">
                <div className="mb-4">
                  <img
                    src="/divya.jpg"
                    alt="Divyanshi Singh"
                    className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-blue-200 shadow-lg"
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Divyanshi Singh
                </h3>
                <p className="text-gray-600">22/11/EC/017</p>
              </div>

              {/* Ketan Khanderkar */}
              <div className="text-center">
                <div className="mb-4">
                  <img
                    src="/ketan.jpg"
                    alt="Ketan Khanderkar"
                    className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-blue-200 shadow-lg"
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Ketan Khanderkar
                </h3>
                <p className="text-gray-600">22/11/EC/058</p>
              </div>
            </div>

            {/* References */}
            <div className="mt-12">
              <h3 className="text-2xl font-serif text-gray-800 mb-4">
                References
              </h3>
              <ul className="list-disc list-inside text-blue-700 space-y-2">
                <li>
                  <a
                    href="https://www.geeksforgeeks.org/theory-of-computation/cyk-algorithm-for-context-free-grammar/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GeeksforGeeks: CYK Algorithm for Context Free Grammar
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.cs.ucdavis.edu/~rogaway/classes/120/winter12/CYK.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    UC Davis: The CYK Algorithm (PDF)
                  </a>
                </li>
                <li>
                  <a
                    href="https://en.wikipedia.org/wiki/CYK_algorithm"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Wikipedia: CYK algorithm
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.geeksforgeeks.org/compiler-design/cocke-younger-kasami-cyk-algorithm/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GeeksforGeeks: Cocke–Younger–Kasami (CYK) Algorithm
                  </a>
                </li>
                <li>
                  <a
                    href="https://cyk.rushikeshtote.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    CYK Visualizer: cyk.rushikeshtote.com
                  </a>
                </li>
                <li>
                  <a
                    href="https://raw.org/tool/cyk-algorithm/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    RAW Tools: CYK Algorithm
                  </a>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
