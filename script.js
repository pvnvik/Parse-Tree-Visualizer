
/**
 * Parse Tree Visualizer Script
 * Implements Earley Parser Algorithm and D3.js visualization.
 */

// --- 1. Grammar Parser ---

function parseGrammar(text) {
    const rules = [];
    text.split(/\n/).forEach(line => {
        line = line.trim();
        if (!line) return;

        // Handle "S -> A | B" format
        const parts = line.split('->');
        if (parts.length !== 2) return;

        const lhs = parts[0].trim();
        const rhsOptions = parts[1].split('|');

        rhsOptions.forEach(rhs => {
            // Tokenize by space.
            // If empty string is represented by ε or just empty, handle it
            let symbols = rhs.trim().split(/\s+/).filter(s => s.length > 0);
            if (symbols.length === 1 && (symbols[0] === 'ε' || symbols[0] === "''" || symbols[0] === '""')) {
                symbols = []; // Empty production
            }
            rules.push({ lhs, rhs: symbols });
        });
    });
    return rules;
}

// --- 2. Earley Parser ---

class EarleyState {
    constructor(rule, dot, startOrigin, comment) {
        this.rule = rule; // { lhs, rhs }
        this.dot = dot;   // index in rhs
        this.startOrigin = startOrigin; // index in input string where this started
        this.comment = comment || "";
        // Backpointers for tree building: [ { state: prev_state, current_complete: completed_state } ]
        // Actually, standard backpointers: pairs of (predecessor_item, completed_child_item)
        this.backPointers = [];
    }

    get nextSymbol() {
        if (this.dot < this.rule.rhs.length) {
            return this.rule.rhs[this.dot];
        }
        return null;
    }

    isComplete() {
        return this.dot >= this.rule.rhs.length;
    }

    toString() {
        const rhsStr = [
            ...this.rule.rhs.slice(0, this.dot),
            "•",
            ...this.rule.rhs.slice(this.dot)
        ].join(" ");
        return `${this.rule.lhs} -> ${rhsStr} (${this.startOrigin})`;
    }

    equals(other) {
        return this.rule === other.rule &&
            this.dot === other.dot &&
            this.startOrigin === other.startOrigin;
    }
}

class EarleyParser {
    constructor(grammarRules, startSymbol) {
        this.rules = grammarRules;
        this.startSymbol = startSymbol;
    }

    parse(inputTokens) {
        // Chart is an array of Sets/Arrays of EarleyStates
        // S[k] holds states for position k
        const S = Array.from({ length: inputTokens.length + 1 }, () => []);

        // Helper to add state if unique
        const addState = (k, state) => {
            // Naive uniqueness check (can be optimized with Set and string keys)
            const exists = S[k].some(existing => existing.equals(state));
            if (!exists) {
                S[k].push(state);
                return state;
            }
            // If it exists, return the existing one so we can merge backpointers if we were doing generic parsing
            // But for simple tree building, we might just want the existing one
            return S[k].find(existing => existing.equals(state));
        };

        // Initialize S[0]
        // Add S' -> S
        // We simulate this by adding all rules for startSymbol starting at 0
        this.rules.filter(r => r.lhs === this.startSymbol).forEach(rule => {
            addState(0, new EarleyState(rule, 0, 0, "start"));
        });

        // Loop through chart columns
        for (let k = 0; k <= inputTokens.length; k++) {
            // Process states in S[k]. Note: S[k] grows during this loop.
            // We use a regular for loop and let it grow.
            for (let i = 0; i < S[k].length; i++) {
                const state = S[k][i];

                if (!state.isComplete()) {
                    const nextSym = state.nextSymbol;
                    // Predictor or Scanner
                    if (this.isNonTerminal(nextSym)) {
                        this.predict(S, k, nextSym);
                    } else {
                        // Scanner
                        if (k < inputTokens.length && nextSym === inputTokens[k]) {
                            this.scan(S, k, state, inputTokens[k]);
                        }
                    }
                } else {
                    // Completer
                    this.complete(S, k, state);
                }
            }
        }

        return S;
    }

    isNonTerminal(sym) {
        return this.rules.some(r => r.lhs === sym);
    }

    predict(S, k, nextSym) {
        this.rules.filter(r => r.lhs === nextSym).forEach(rule => {
            const newState = new EarleyState(rule, 0, k, "predictor");
            // No backpointer for prediction start
            const added = this.addState(S, k, newState);
        });
    }

    scan(S, k, fromState, token) {
        // Create new state advanced by 1
        const newState = new EarleyState(fromState.rule, fromState.dot + 1, fromState.startOrigin, "scanner");
        // For scanner, the "child" is just the token.
        // We can store backpointer: (predecessor=fromState, child=token)
        newState.backPointers.push({ predecessor: fromState, child: token });

        this.addState(S, k + 1, newState);
    }

    complete(S, k, completedState) {
        // completedState is: A -> ... • (startOrigin = j)
        // Go back to S[j] and find states expecting A
        const j = completedState.startOrigin;

        S[j].forEach(oldState => {
            if (!oldState.isComplete() && oldState.nextSymbol === completedState.rule.lhs) {
                // Advance oldState
                const advancedState = new EarleyState(oldState.rule, oldState.dot + 1, oldState.startOrigin, "completer");
                // Backpointer: (predecessor=oldState, child=completedState)
                advancedState.backPointers.push({ predecessor: oldState, child: completedState });

                this.addState(S, k, advancedState);
            }
        });
    }

    addState(S, k, state) {
        // Check strict equality to ensure we merge backpointers for ambiguous parses
        const existingIndex = S[k].findIndex(e => e.equals(state));

        if (existingIndex !== -1) {
            // State exists. Merge backpointers!
            const existing = S[k][existingIndex];
            state.backPointers.forEach(bp => {
                // Avoid duplicate backpointers
                // This check is a bit complex for objects, but let's try shallow or simple check
                // For simplicity, just push. D3 tree builder handles branching.
                existing.backPointers.push(bp);
            });
            return existing;
        } else {
            S[k].push(state);
            return state;
        }
    }
}

// --- 3. Tree Builder ---

function buildTree(chart, inputTokens, startSymbol) {
    const lastColumn = chart[inputTokens.length];
    // Find a completed start symbol spanning 0 to end
    const rootState = lastColumn.find(s =>
        s.rule.lhs === startSymbol &&
        s.isComplete() &&
        s.startOrigin === 0
    );

    if (!rootState) return null;

    // Recursive function to build D3 hierarchy
    function recurse(state) {
        // If it's a leaf (token), shouldn't happen here usually because we wrap tokens in nodes?
        // Actually, our states are non-terminals.

        const node = { name: state.rule.lhs, children: [] };

        if (!state.backPointers || state.backPointers.length === 0) {
            // Epsilon or pure terminal rule?
            return node;
        }

        // AMBIGUITY HANDLING:
        // If backPointers has multiple entries pointing to different parse trees, we pick the first one for now.
        // A robust visualizer might let users cycle through ambiguities.
        // Let's just pick the first valid derivation found.

        // Wait, backPointers in our structure:
        // scan: { predecessor (state), child (token_string) }
        // complete: { predecessor (state), child (completed_state) }

        // To reconstruct the WHOLE sequence of children for this rule:
        // We need to trace back from the COMPLETE state (dot at end) to the START state (dot at 0).
        // Each step takes us from dot=N to dot=N-1.

        let currentState = state;
        const children = [];

        while (currentState.dot > 0) {
            // We must have at least one backpointer
            // Pick first for ambiguity resolution
            const bp = currentState.backPointers[0];

            if (typeof bp.child === 'string') {
                // It was a scan
                children.unshift({ name: bp.child });
            } else {
                // It was a complete, child is a generic State
                children.unshift(recurse(bp.child));
            }

            currentState = bp.predecessor;
        }

        node.children = children;
        return node;
    }

    // Because the "rootState" is a completed item for S, it looks like:
    // S -> A B •
    // Its backpointer points to S -> A • and child B (completed).
    return recurse(rootState);
}


// --- 4. Main & Visualization ---

document.getElementById('visualizeBtn').addEventListener('click', () => {
    const startSymbol = document.getElementById('startSymbol').value.trim();
    const grammarText = document.getElementById('grammarInput').value;
    const stringText = document.getElementById('stringInput').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    const vizContainer = document.getElementById('vizContainer');

    errorMsg.textContent = '';
    vizContainer.innerHTML = ''; // Clear previous

    if (!startSymbol || !grammarText) {
        errorMsg.textContent = 'Please provide grammar and start symbol.';
        return;
    }

    try {
        const rules = parseGrammar(grammarText);
        const parser = new EarleyParser(rules, startSymbol);
        const tokens = stringText.split(/\s+/).filter(s => s.length > 0);

        // Edge case: Empty input string
        if (stringText === "") {
            // Handle empty string if grammar allows S -> epsilon
            // Not fully handled in this simple lexer logic
        }

        const chart = parser.parse(tokens);
        const treeData = buildTree(chart, tokens, startSymbol);

        if (!treeData) {
            errorMsg.textContent = 'Parsing failed. String not acceptable by grammar or ambiguous start.';
            return;
        }

        drawTree(treeData);

    } catch (e) {
        console.error(e);
        errorMsg.textContent = 'Error: ' + e.message;
    }
});

function drawTree(data) {
    const width = 800;
    const height = 600;

    // Clear
    d3.select("#vizContainer").selectAll("*").remove();

    const svg = d3.select("#vizContainer").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(40,40)");

    const treeLayout = d3.tree().size([width - 100, height - 100]);
    const root = d3.hierarchy(data);
    treeLayout(root);

    // Links
    svg.selectAll(".link")
        .data(root.links())
        .enter().append("path")
        .attr("class", "link")
        .attr("d", d3.linkVertical()
            .x(d => d.x)
            .y(d => d.y));

    // Nodes
    const node = svg.selectAll(".node")
        .data(root.descendants())
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    node.append("circle")
        .attr("r", 20);

    node.append("text")
        .attr("dy", ".35em")
        .text(d => d.data.name);
}
