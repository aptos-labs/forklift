# Building Forklift with AI Agents

## What's Forklift?

Forklift is a TypeScript framework for developing, testing, and scripting Aptos Move smart contracts. It's a thin wrapper around the CLI's Transaction Simulation Sessions — lots of structured boilerplate with clear logic, which made it a great candidate for AI-driven development.

Check out the [Forklift repo](https://github.com/aptos-labs/forklift) if you're curious.

## Developing Forklift with AI

### Phase 1: Bootstrapping

I started with minimal specs: an incomplete README with the high-level design, the `Harness` class interface and a few core methods, all described in plain English, and past design docs for Transaction Simulation Sessions (what Forklift wraps).

This phase needed the most hand-holding:
- Reviewed AI-generated code carefully, suggested architectural changes
- Fine-tuned critical details (e.g., universal helper run CLI commands and parse outputs)
- Guided AI on transaction semantics and invariants it couldn't figure out on its own

Once the core was stable, I had AI generate a testsuite. Modern agents do a really good job here — they write code, run it, parse errors, and iterate. The agent even ran CLI commands directly to figure out output formats. Still, I had to step in to help it understand certain Aptos transaction flows and invariants.

AI also generated the CI workflow configs.

### Phase 2: Adding Features

With the foundation in place, I was able to add features at much higher velocity.

The existing code and docs gave AI enough context to work on its own. My prompts became one-liners: *"Implement X, use CLI command Y."*

AI would add the method with docs, write tests, and debug until tests passed — with minimal help from me. A few features needed CLI-side changes, and thus more manual work.

### Phase 3: Polishing

Once implementation was done, I had AI finish the README with full API docs. The TipJar tutorial was also mostly AI-generated, though I had to ask it to simplify the scope and better tune it for the target audience.

Both needed some back-and-forth, but way less than bootstrapping.

## Key Takeaways

### Docs and tests become first-class dev tools

With AI, documentation serves two purposes: (1) clarifying the design for humans, and (2) giving AI permanent context to work with. Tests are precise specs that AI can verify against.

This enables a shift in workflow:

|             | Workflow |
|-------------|----------|
| Traditional | PoC → design doc → implementation → polishing/docs |
| AI-Assisted | Design/docs → AI-generated PoC + tests → features → polishing |

"Notion Engineer" is no longer a joke.

### "Maintainable" means something different now

Documentation that used to be prohibitively expensive to maintain (e.g., documenting every parameter) becomes affordable with AI.

Designs with repetitive boilerplate but clear logic separation become trivially maintainable — AI handles the mechanical work. This might even apply to porting the project to another language (e.g., Forklift → Python).

For the right projects, maintainability might be better measured by *how easily AI can understand and evolve the codebase*.

### Today's AI agents have become really capable
- **Multi-file reasoning**: Edit a method, and AI fixes callsites, adds tests, updates docs
- **Figuring out implementation details**: AI tracks data flow effectively and is good at reverse-engineering input/output formats
- **Tool use**: AI runs bash commands and extracts useful info from stdout
