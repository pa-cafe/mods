# Courses

A course is a pack of units. Each unit has a handout to read, practice questions, and at most one task the barista hands to a resident.

## The contract

A pack is JSON. [`pack.ts`](pack.ts) holds its schema (`courseSchema`) and the checks beyond the schema (`courseProblems`). A pack is ready when it parses and `courseProblems` returns nothing.

- Text comes with Traditional Chinese (`zh-TW`) and any of the other languages.
- A task names one evidence check from the list in `pack.ts`. The cafe runs the check. A pack cannot mark its own task done.
- A pack cannot grant coffee beans. The cafe decides what a finished task earns.
- Images and video are files under `/art/courses/`. Links go to recipes the cafe serves under `/automation-templates/`.
- `price` is `free`.

No course is published yet. The first is being written.
