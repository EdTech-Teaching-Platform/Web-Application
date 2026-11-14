/** @vitest-environment jsdom */
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("../src/services/supabaseClient", () => ({ supabase: { rpc: vi.fn() } }));

import QuestionTypePicker, { QuestionAnswerFields } from "../src/portals/admin/components/QuestionTypePicker";
import {
  QTYPE, isBlockedQuestionType, isWrittenType, normalizeQuestionType, questionPayload, rejectBlockedQuestions,
  validateQuestionDraft,
} from "../src/portals/admin/data/questionTypes";
import { csvToRows, normalizeWizardState, validateCsvRows, validateWizard, ROW_STATUS, initialWizardState } from "../src/portals/admin/data/testSeriesWizard";
import { AI_QUESTION_TYPE_OPTIONS, parseQuestionPaper, stripBlockedQuestions } from "../src/portals/admin/data/aiTestBuilderMock";
import { mapQuestion } from "../src/portals/admin/services/testSeriesApi";
import { AI_ENABLED, SUBJECTIVE_ENABLED } from "../src/portals/admin/utils/featureFlags";

afterEach(() => cleanup());

// Short / long / subjective questions are on since 20261115090000: their
// answers are graded by AI (evaluate-subjective). AI test building stays off.
describe("feature flags", () => {
  it("AI test building off; subjective questions (AI-graded) on", () => {
    expect(AI_ENABLED).toBe(false);
    expect(SUBJECTIVE_ENABLED).toBe(true);
  });
});

// -----------------------------------------------------------------------------
describe("question type picker", () => {
  const ALL = ["MCQ (single answer)", "MCQ (multiple answers)", "True / False", "Fill in the blank", "Short answer", "Long answer", "Subjective"];

  for (const variant of ["cards", "pills"]) {
    it(`(${variant}) offers every type, with no "Coming soon"`, () => {
      render(<QuestionTypePicker variant={variant} value="mcq_single" onChange={vi.fn()} />);
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(7);
      for (const label of ALL) expect(radios.find((r) => r.textContent.startsWith(label))).toBeEnabled();
      expect(screen.queryByText("Coming soon")).toBeNull();
    });

    it(`(${variant}) selects written types too`, () => {
      const onChange = vi.fn();
      render(<QuestionTypePicker variant={variant} value="mcq_single" onChange={onChange} />);
      const radios = screen.getAllByRole("radio");
      fireEvent.click(radios.find((r) => r.textContent.startsWith("Subjective")));
      fireEvent.click(radios.find((r) => r.textContent.startsWith("Fill in the blank")));
      expect(onChange.mock.calls.map((c) => c[0])).toEqual(["subjective", "fill_blank"]);
    });
  }

  it("a written question asks for a model answer and an optional marking guide", () => {
    const onChange = vi.fn();
    render(<QuestionAnswerFields q={{ type: "subjective", modelAnswer: "", answerInstructions: "" }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Model answer"), { target: { value: "Charge is conserved." } });
    fireEvent.change(screen.getByLabelText("Marking guide (optional)"), { target: { value: "2 + 3" } });
    expect(onChange).toHaveBeenCalledWith({ modelAnswer: "Charge is conserved." });
    expect(onChange).toHaveBeenCalledWith({ answerInstructions: "2 + 3" });
  });

  it("shows multi-select correct answers for MCQ (multiple) and an accepted answer for fill in the blank", () => {
    const onChange = vi.fn();
    const { rerender } = render(<QuestionAnswerFields q={{ type: "mcq_multi", correctAnswers: ["A"] }} onChange={onChange} />);
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(4);
    fireEvent.click(boxes[2]);
    expect(onChange).toHaveBeenCalledWith({ correctAnswers: ["A", "C"] });
    rerender(<QuestionAnswerFields q={{ type: "fill_blank", acceptedAnswer: "" }} onChange={onChange} />);
    expect(screen.getByLabelText("Accepted answer")).toBeInTheDocument();
    expect(screen.queryByText(/model answer/i)).not.toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
describe("question rules", () => {
  it("every subjective spelling is a written (AI-graded) type, and none is blocked", () => {
    for (const t of ["short_answer", "long_answer", "subjective", "descriptive", "Long answer", "essay"]) {
      expect(isWrittenType(t)).toBe(true);
      expect(isBlockedQuestionType(t)).toBe(false);
    }
    for (const t of ["mcq", "objective", "mcq_multi", "true_false", "fill_blank", "numerical"]) {
      expect(isWrittenType(t)).toBe(false);
    }
    expect(normalizeQuestionType("objective")).toBe(QTYPE.MCQ_SINGLE);
    expect(normalizeQuestionType("numerical")).toBe(QTYPE.FILL_BLANK);
  });

  it("validates each type; a written question needs a model answer", () => {
    const base = { text: "Q?", marks: 2, negativeMarks: 0 };
    expect(validateQuestionDraft({ ...base, type: "subjective" })).toContain("Add a model answer: the AI grades students' answers against it.");
    expect(validateQuestionDraft({ ...base, type: "long_answer", modelAnswer: "Because." })).toEqual([]);
    expect(validateQuestionDraft({ ...base, type: "fill_blank", acceptedAnswer: " " })).toContain("Enter the accepted answer.");
    expect(validateQuestionDraft({ ...base, type: "true_false", correctAnswer: "" })).toContain("Choose True or False as the correct answer.");
    expect(validateQuestionDraft({ ...base, type: "mcq_multi", optionA: "a", optionB: "b", optionC: "c", optionD: "d", correctAnswers: [] }))
      .toContain("Select at least one correct answer.");
    expect(validateQuestionDraft({ ...base, type: "mcq_single", optionA: "a", optionB: "b", optionC: "c", optionD: "d", correctAnswer: "B" })).toEqual([]);
  });

  it("builds the server payload per type", () => {
    const q = { text: " Q ", marks: "2", negativeMarks: "0.5", optionA: "a", optionB: "b", optionC: "c", optionD: "d" };
    expect(questionPayload({ ...q, type: "mcq_multi", correctAnswers: ["C", "A"] })).toMatchObject({
      type: "mcq_multi", text: "Q", marks: 2, negativeMarks: 0.5, correctAnswers: ["A", "C"],
      options: [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }, { key: "D", text: "d" }],
    });
    expect(questionPayload({ ...q, type: "true_false", correctAnswer: "B" })).toMatchObject({
      type: "true_false", correctAnswers: ["B"], options: [{ key: "A", text: "True" }, { key: "B", text: "False" }],
    });
    expect(questionPayload({ ...q, type: "fill_blank", acceptedAnswer: " Paris " })).toMatchObject({
      type: "fill_blank", options: [], correctAnswer: "Paris",
    });
    expect(questionPayload({ ...q, type: "mcq_single", correctAnswer: "A" })).not.toHaveProperty("modelAnswer");
    expect(questionPayload({ ...q, type: "subjective", modelAnswer: " Because. ", answerInstructions: " 2 + 3 " })).toMatchObject({
      type: "subjective", options: [], modelAnswer: "Because.", answerInstructions: "2 + 3",
    });
  });

  it("imports keep written questions now", () => {
    const { accepted, rejected } = rejectBlockedQuestions([{ type: "mcq" }, { type: "long_answer" }, { type: "fill_blank" }]);
    expect(accepted.map((q) => q.type)).toEqual(["mcq", "long_answer", "fill_blank"]);
    expect(rejected).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
describe("CSV import", () => {
  const header = "question,optionA,optionB,optionC,optionD,correct,marks,negative,type,difficulty,subject,topic,explanation";
  function report(lines) {
    const { rows, error } = csvToRows([header, ...lines].join("\n"));
    expect(error).toBe("");
    return validateCsvRows(rows, new Set());
  }

  it("imports written rows with their model answer (correct column); without one they're incomplete", () => {
    const r = report([
      '"Explain gravity",,,,,"Mass attracts mass.",5,0,subjective,medium,Physics,,',
      '"Define force",,,,,"A push or a pull.",2,0,short_answer,easy,Physics,,',
      '"Describe the water cycle",,,,,,8,0,long_answer,hard,Geography,,',
    ]);
    expect(r.map((row) => row.status)).toEqual([ROW_STATUS.VALID, ROW_STATUS.VALID, ROW_STATUS.INCOMPLETE]);
    expect(r[0].parsed).toMatchObject({ type: "subjective", modelAnswer: "Mass attracts mass.", negativeMarks: 0 });
    expect(r[2].issues.join(" ")).toMatch(/Model answer is missing/);
    expect(r[2].question).toBe("Describe the water cycle");   // the row keeps its text
  });

  it("imports MCQ (single and multiple), true / false and fill in the blank rows", () => {
    const r = report([
      '"One?",a,b,c,d,B,4,1,mcq,easy,,,',
      '"Vectors?",Velocity,Speed,Force,Mass,A|C,4,1,mcq_multi,medium,,,',
      '"Sky is blue",,,,,True,1,0,true_false,easy,,,',
      '"Capital of France",,,,,Paris,1,0,fill_blank,easy,,,',
    ]);
    expect(r.map((row) => row.status)).toEqual([ROW_STATUS.VALID, ROW_STATUS.VALID, ROW_STATUS.VALID, ROW_STATUS.VALID]);
    expect(r[0].parsed).toMatchObject({ type: "mcq_single", correctAnswer: "B" });
    expect(r[1].parsed).toMatchObject({ type: "mcq_multi", correctAnswers: ["A", "C"] });
    expect(r[2].parsed).toMatchObject({ type: "true_false", correctAnswer: "A" });
    expect(r[3].parsed).toMatchObject({ type: "fill_blank", acceptedAnswer: "Paris" });
    expect(r[0].question).toBe("One?");
  });

  it("flags incomplete rows for the new types", () => {
    const r = report(['"Capital?",,,,,,1,0,fill_blank,easy,,,', '"True?",,,,,maybe,1,0,true_false,easy,,,']);
    expect(r[0].status).toBe(ROW_STATUS.INCOMPLETE);
    expect(r[1].status).toBe(ROW_STATUS.INVALID);
  });
});

// -----------------------------------------------------------------------------
describe("AI / paste import", () => {
  it("the AI generator may offer short and long answers (AI building itself is still off)", () => {
    expect(AI_QUESTION_TYPE_OPTIONS).toContain("short_answer");
    expect(AI_QUESTION_TYPE_OPTIONS).toContain("long_answer");
  });

  it("a pasted paper keeps its written questions", () => {
    const test = stripBlockedQuestions({
      sections: [{ questions: [{ type: "mcq" }, { type: "long_answer" }, { type: "short_answer" }] }],
      warnings: [],
    });
    expect(test.sections[0].questions).toEqual([{ type: "mcq" }, { type: "long_answer" }, { type: "short_answer" }]);
    expect(test.warnings).toEqual([]);
    const parsed = parseQuestionPaper("1. Explain the theory of relativity in detail.\n\n2. Which is a prime? a) 4 b) 6 c) 7 d) 9\nAnswer: c");
    expect(parsed.sections.flatMap((x) => x.questions).length).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------------------------
describe("wizard drafts", () => {
  it("moves legacy objective questions to MCQ; a written question needs its model answer", () => {
    const state = normalizeWizardState({
      ...initialWizardState(),
      name: "Series",
      tests: [{ wid: "t1", name: "Test 1", duration: 30, questions: [
        { wid: "q1", type: "objective", text: "One?", optionA: "a", optionB: "b", optionC: "c", optionD: "d", correctAnswer: "A", marks: 4 },
        { wid: "q2", type: "subjective", text: "Explain", marks: 5 },
      ], window: { mode: "inherit" } }],
    });
    expect(state.tests[0].questions[0]).toMatchObject({ type: "mcq_single", correctAnswers: ["A"] });
    const v = validateWizard(state, { existingSeries: [] });
    expect(v.draftErrors.find((e) => e.includes("Remove the"))).toBeUndefined();
    expect(v.errors.join(" ")).toMatch(/1 question is missing options, a correct answer or a model answer/);
    const fixed = { ...state, tests: [{ ...state.tests[0], questions: state.tests[0].questions.map((q) => (q.wid === "q2" ? { ...q, modelAnswer: "Because." } : q)) }] };
    expect(validateWizard(fixed, { existingSeries: [] }).errors.join(" ")).not.toMatch(/missing options/);
  });
});

// -----------------------------------------------------------------------------
describe("loading questions from the server", () => {
  it("keeps the real type, multi answers, the accepted answer and a written question's model answer", () => {
    const opts = (labels, correct) => labels.map((label, i) => ({ id: `o${i}`, option_key: "ABCD"[i], label, is_correct: correct.includes(i), position: i }));
    expect(mapQuestion({ id: "1", type: "mcq", options: opts(["a", "b", "c", "d"], [0, 2]) })).toMatchObject({
      type: "mcq_multi", kind: "objective", correctAnswers: ["A", "C"],
    });
    expect(mapQuestion({ id: "2", type: "fill_blank", options: opts(["Paris"], [0]) })).toMatchObject({
      type: "fill_blank", acceptedAnswer: "Paris",
    });
    const subj = mapQuestion({ id: "3", type: "subjective", options: opts(["Manual grading: see rubric"], [0]) });
    expect(subj).toMatchObject({ type: "subjective", kind: "subjective", modelAnswer: "" });
    expect(mapQuestion({ id: "4", type: "long_answer", answer_instructions: "2 + 3", options: opts(["Because."], [0]) }))
      .toMatchObject({ kind: "subjective", modelAnswer: "Because.", answerInstructions: "2 + 3" });
  });
});
