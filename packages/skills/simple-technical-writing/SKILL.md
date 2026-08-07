---
name: diego-simple-technical-writing
description: |
  Write, rewrite, or review human-readable technical prose in clear, direct
  English while preserving facts, uncertainty, and technical tokens. Apply it
  by default to plans, updates, diagnoses, explanations, reviews, and other
  human-readable communication during coding, debugging, analysis, testing,
  and operations. Do not apply the prose rules to source code, generated diffs,
  logs, or protected technical content. Also use for requests involving STE,
  Simplified Technical English, ASD-STE100, de-slopping, non-native readers, or
  translation-ready technical content.
license: MIT
metadata:
  version: "0.0.3"
  standard: ASD-STE100 Issue 9 (2025-01-15)
  compliance: inspired-subset
  scope: software-development-and-operations
---

# Simple Technical Writing

Apply this skill to human-readable technical content created during software development and operations.

This skill governs prose. It does not change the technical task, the reasoning process, or source code.

## Apply this skill by default

Apply this skill to all human-readable technical communication during software development.

This requirement includes communication during coding, debugging, analysis, testing, and operations.

Do not wait for the user to request clearer prose.

Also use this skill when another skill, profile, or workflow invokes it.

The requested prose can include:

- observations, diagnoses, hypotheses, and remediation steps
- requirements, non-goals, assumptions, risks, and acceptance criteria
- design explanations, decisions, alternatives, and data flows
- implementation plans, progress updates, and change summaries
- review comments, pull request descriptions, and commit messages
- runbooks, procedures, errors, release notes, and incident reports
- prompts, skills, workflows, and agent instructions
- technical UI messages and support responses

Also apply this skill when the user asks for:

- STE or Simplified Technical English
- ASD-STE100-style technical writing
- clearer or less ambiguous technical text
- text for non-native English readers
- technical content that is easier to translate
- removal of AI filler or "AI slop"

## Content exclusions

Do not apply this skill to:

- source code
- generated patches or diffs
- literal identifiers, commands, flags, file paths, or API names
- raw logs, stack traces, or quoted error messages
- marketing or sales copy
- launch posts and advertisements
- brand, editorial, narrative, or expressive writing
- casual conversation that does not contain technical work

For code comments, apply the rules only to explanatory prose. Preserve identifiers and required technical terminology.

## Preserve technical meaning

Preserve all facts, requirements, constraints, and uncertainty.

Do not change:

- code blocks
- inline code
- identifiers
- commands and flags
- file paths and URLs
- API names and endpoint names
- configuration keys
- product names
- quoted error messages
- log lines and protocol content

Do not add claims, requirements, causes, measurements, or implementation details that the source does not support.

Do not turn a hypothesis into a fact. State uncertainty with explicit terms such as `Known`, `Likely`, `Possible`, or `Unknown`.

## Classify the text

Classify each passage before you write it.

### Procedural text

Procedural text tells the reader what to do.

- Use imperative sentences.
- Put one action in each sentence.
- Put a required condition before the action.
- Keep each sentence at 20 words or fewer.
- Put warnings before dangerous or irreversible actions.

Example:

Incorrect:

> Run the migration after checking that the backup completed successfully.

Correct:

> Make sure that the backup is complete. Then run the migration.

### Descriptive text

Descriptive text explains what happened, what exists, or how a system works.

- Use simple verb tenses.
- Keep each sentence at 25 words or fewer.
- Put one main fact in each sentence.
- Keep one topic in each paragraph.
- Use no more than six sentences in each paragraph.

Do not mix procedural and descriptive text in one passage when separate sections make the distinction clearer.

## General writing rules

Use short, complete sentences.

Use active voice when the actor is known.

Use simple verb tenses.

Use one term for each concept. Do not rotate synonyms.

Use American English spelling.

Do not use contractions or semicolons.

Keep articles and necessary uses of `that`.

Use vertical lists for multiple steps, requirements, alternatives, or results.

Remove filler, repetition, vague hedging, and unsupported adjectives.

Preserve meaningful uncertainty and technical qualifications.

Prefer direct words:

- use, not utilize or leverage
- before, not prior to
- if, not in the event that
- can, not may or might, when you describe capability or possibility
- must, not should, when you state a requirement
- for example, not e.g.
- that is, not i.e.

Delete words that add no technical information, such as:

- simply
- easily
- seamlessly
- robust
- powerful
- comprehensive
- it is important to note
- it is worth noting
- in order to

## Use common vocabulary

Assume that the reader understands software but might not be a native English speaker.

Use a common word when it preserves the exact technical meaning.

Do not use a rare or formal word only because it is shorter. Prefer these words:

- temporary, not transient
- invalid, not malformed
- out of date, not stale
- later, not subsequently

These preferences do not apply to protected technical content or established domain terms.

If a technical term is necessary, explain it in common words the first time that you use it.

Example:

Unclear:

> The validation fails open.

Clear:

> The validation fails open. This means that the system accepts data when validation cannot finish.

Avoid idioms when a literal description is accurate. This rule includes phrases such as `falls back` and `fails open`.

Avoid groups of more than three consecutive nouns. Rewrite the group as a clause when possible.

Example:

Unclear:

> A paid preview settlement recovery failure can overcharge the customer.

Clear:

> If recovery fails while the system settles a paid preview, the customer can be overcharged.

For review findings, state the user-visible or system-visible consequence before the internal cause.

Use a direct consequence in the heading. Put detailed implementation terms in the explanation.

## Debugging and failure analysis

Separate facts from hypotheses.

Use this order when it helps the reader:

1. State the observed behavior.
2. State the evidence.
3. State the known or likely cause.
4. State the next diagnostic action.
5. State the remediation only when the evidence supports it.

Preserve exact errors, logs, identifiers, and commands.

Do not invent a root cause, retry count, timeout, dependency, or system behavior.

If evidence is incomplete, state what is unknown and what evidence can resolve it.

## PRDs and requirements

Write one requirement per statement.

Use `must` for mandatory behavior.

Use `can` for supported capability.

Separate these sections when applicable:

- problem
- goals
- non-goals
- users
- requirements
- acceptance criteria
- assumptions
- dependencies
- risks
- open questions

Do not convert an idea, preference, or assumption into a requirement.

Use measurable acceptance criteria when the supplied facts support them.

## Design and architecture

State the decision before its rationale.

Separate facts, constraints, assumptions, alternatives, and trade-offs.

Use the same name for each component throughout the document.

Preserve established domain terms when a simpler word would change the meaning.

Do not claim that a design is scalable, secure, fast, or reliable without evidence or a defined property.

## Coding sessions and reviews

Apply this skill to plans, explanations, progress reports, review feedback, and final summaries.

Do not alter source code only to satisfy the prose rules.

When you describe a code change:

1. State what changed.
2. State where it changed.
3. State why it changed.
4. State how it was verified.
5. State remaining risks or unknowns.

Keep code symbols and file names exact.

Write review feedback as a specific observation, consequence, and correction.

## Output behavior

When the user asks for finished text, return only the finished text unless they request commentary.

When the user asks for a review, report:

1. The source text or relevant excerpt.
2. The problem.
3. A corrected version.

When this skill runs as a development-session policy, apply the rules to technical prose without announcing the skill.

## Self-check

Before returning technical prose:

1. Confirm that the technical meaning did not change.
2. Confirm that protected technical content stayed exact.
3. Confirm that uncertainty did not become certainty.
4. Split sentences that exceed the applicable word limit.
5. Remove contractions and semicolons.
6. Remove filler and unnecessary repetition.
7. Make terminology consistent.
8. Confirm that procedural conditions appear before actions.
9. Confirm that the skill did not affect marketing or expressive content.
10. Replace uncommon words when a common word preserves the meaning.
11. Explain necessary technical terms on first use.
12. Rewrite groups of more than three consecutive nouns.
13. Put the consequence before the internal cause in review findings.

## Compliance boundary

This skill uses a focused, software-oriented subset of ASD-STE100 principles.

It does not include the complete controlled dictionary or all 53 rules. It does not claim formal ASD-STE100 compliance.
