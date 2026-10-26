/** @vitest-environment jsdom */
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("../src/services/supabaseClient", () => ({ supabase: { rpc: vi.fn() } }));

import QuestionTypePicker, { QuestionAnswerFields } from "../src/portals/admin/components/QuestionTypePicker";
import {
  QTYPE, SUBJECTIVE_BLOCKED_MESSAGE, isBlockedQuestionType, normalizeQuestionType, questionPayload, rejectBlockedQuestions,
  validateQuestionDraft,
} from "../src/portals/admin/data/questionTypes";
import { csvToRows, normalizeWizardState, validateCsvRows, validateWizard, ROW_STATUS, initialWizardState } from "../src/portals/admin/data/testSeriesWizard";
import { AI_QUESTION_TYPE_OPTIONS, parseQuestionPaper, stripBlockedQuestions } from "../src/portals/admin/data/aiTestBuilderMock";
import { mapQuestion } from "../src/portals/admin/services/testSeriesApi";
import { AI_ENABLED, SUBJECTIVE_ENABLED } from "../src/portals/admin/utils/featureFlags";

afterEach(() => cleanup());

describe("feature flags", () => {
  it("keeps AI and subjective questions switched off", () => {
    expect(AI_ENABLED).toBe(false);
    expect(SUBJECTIVE_ENABLED).toBe(false);
  });
});

// -----------------------------------------------------------------------------
describe("question type picker", () => {
  const AVAILABLE = ["MCQ (single answer)", "MCQ (multiple answers)", "True / False", "Fill in the blank"];
  const SOON = ["Short answer", "Long answer", "Subjective"];

  for (const variant of ["cards", "pills"]) {
    it(`(${variant}) offers MCQ, true / false and fill in the blank, and badges the rest as coming soon`, () => {
      const onChange = vi.fn();
      render(<QuestionTypePicker variant={variant} value="mcq_single" onChange={onChange} />);
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(7);
      for (const label of AVAILABLE) {
        expect(radios.find((r) => r.textContent.startsWith(label))).toBeEnabled();
      }
      for (const label of SOON) {
        const btn = radios.find((r) => r.textContent.startsWith(label));
        expect(btn).toBeDisabled();
        expect(btn).toHaveAttribute("aria-disabled", "true");
        expect(btn).toHaveTextContent("Coming soon");
      }
      expect(screen.getAllByText("Coming soon")).toHaveLength(3);
    });

    it(`(${variant}) never selects a coming-soon type, and selects the available ones`, () => {
      const onChange = vi.fn();
      render(<QuestionTypePicker variant={variant} value="mcq_single" onChange={onChange} />);
      const radios = screen.getAllByRole("radio");
      fireEvent.click(radios.find((r) => r.textContent.startsWith("Subjective")));
      fireEvent.click(radios.find((r) => r.textContent.startsWith("Long answer")));
      expect(onChange).not.toHaveBeenCalled();
      fireEvent.click(radios.find((r) => r.textContent.startsWith("MCQ (multiple answers)")));
      fireEvent.click(radios.find((r) => r.textContent.startsWith("Fill in the blank")));
      expect(onChange.mock.calls.map((c) => c[0])).toEqual(["mcq_multi", "fill_blank"]);
    });
  }

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
  it("treats every subjective spelling as blocked", () => {
    for (const t of ["short_answer", "long_answer", "subjective", "descriptive", "Long answer", "essay"]) {
      expect(isBlockedQuestionType(t)).toBe(true);
    }
    for (const t of ["mcq", "objective", "mcq_multi", "true_false", "fill_blank", "numerical"]) {
      expect(isBlockedQuestionType(t)).toBe(false);
    }
    expect(normalizeQuestionType("objective")).toBe(QTYPE.MCQ_SINGLE);
    expect(normalizeQuestionType("numerical")).toBe(QTYPE.FILL_BLANK);
  });

  it("validates each type and refuses subjective drafts", () => {
    const base = { text: "Q?", marks: 2, negativeMarks: 0 };
    expect(validateQuestionDraft({ ...base, type: "subjective" })).toContain(SUBJECTIVE_BLOCKED_MESSAGE);
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
  });

  it("splits imported questions into accepted and rejected", () => {
    const { accepted, rejected } = rejectBlockedQuestions([{ type: "mcq" }, { type: "long_answer" }, { type: "fill_blank" }]);
    expect(accepted.map((q) => q.type)).toEqual(["mcq", "fill_blank"]);
    expect(rejected).toEqual([{ question: { type: "long_answer" }, reason: SUBJECTIVE_BLOCKED_MESSAGE }]);
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

  it("rejects short answer, long answer and subjective rows with a clear message", () => {
    const r = report([
      '"Explain gravity",,,,,,5,0,subjective,medium,Physics,,',
      '"Define force",,,,,,2,0,short_answer,easy,Physics,,',
      '"Describe the water cycle",,,,,,8,0,long_answer,hard,Geography,,',
    ]);
    for (const row of r) {
      expect(row.status).toBe(ROW_STATUS.INVALID);
      expect(row.question).toBeNull();
      expect(row.issues.join(" ")).toContain("not supported yet");
      expect(row.issues.join(" ")).toContain(SUBJECTIVE_BLOCKED_MESSAGE);
    }
  });

  it("imports MCQ (single and multiple), true / false and fill in the blank rows", () => {
    const r = report([
      '"One?",a,b,c,d,B,4,1,mcq,easy,,,',
      '"Vectors?",Velocity,Speed,Force,Mass,A|C,4,1,mcq_multi,medium,,,',
      '"Sky is blue",,,,,True,1,0,true_false,easy,,,',
      '"Capital of France",,,,,Paris,1,0,fill_blank,easy,,,',
    ]);
    expect(r.map((row) => row.status)).toEqual([ROW_STATUS.VALID, ROW_STATUS.VALID, ROW_STATUS.VALID, ROW_STATUS.VALID]);
    expect(r[0].question).toMatchObject({ type: "mcq_single", correctAnswer: "B" });
    expect(r[1].question).toMatchObject({ type: "mcq_multi", correctAnswers: ["A", "C"] });
    expect(r[2].question).toMatchObject({ type: "true_false", correctAnswer: "A" });
    expect(r[3].question).toMatchObject({ type: "fill_blank", acceptedAnswer: "Paris" });
  });

  it("flags incomplete rows for the new types", () => {
    const r = report(['"Capital?",,,,,,1,0,fill_blank,easy,,,', '"True?",,,,,maybe,1,0,true_false,easy,,,']);
    expect(r[0].status).toBe(ROW_STATUS.INCOMPLETE);
    expect(r[1].status).toBe(ROW_STATUS.INVALID);
  });
});

// -----------------------------------------------------------------------------
describe("AI / paste import", () => {
  it("does not offer short or long answers to the AI generator", () => {
    expect(AI_QUESTION_TYPE_OPTIONS).not.toContain("short_answer");
    expect(AI_QUESTION_TYPE_OPTIONS).not.toContain("long_answer");
  });

  it("rejects subjective questions in a pasted paper with a warning", () => {
    const test = stripBlockedQuestions({
      sections: [{ questions: [{ type: "mcq" }, { type: "long_answer" }, { type: "short_answer" }] }],
      warnings: [],
    });
    expect(test.sections[0].questions).toEqual([{ type: "mcq" }]);
    expect(test.warnings[0]).toMatch(/^2 short \/ long answer questions were rejected/);
    const parsed = parseQuestionPaper("1. Explain the theory of relativity in detail.\n\n2. Which is a prime? a) 4 b) 6 c) 7 d) 9\nAnswer: c");
    const types = parsed.sections.flatMap((s) => s.questions.map((q) => q.type));
    expect(types.every((t) => !isBlockedQuestionType(t))).toBe(true);
  });
});

// -----------------------------------------------------------------------------
describe("wizard drafts", () => {
  it("moves legacy objective questions to MCQ and blocks saving while a subjective one remains", () => {
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
    const msg = v.draftErrors.find((e) => e.includes("subjective"));
    expect(msg).toMatch(/^Remove the 1 short \/ long \/ subjective question/);
    expect(v.errors).toContain(msg);
  });
});

// -----------------------------------------------------------------------------
describe("loading questions from the server", () => {
  it("keeps the real type, multi answers and the accepted answer; marks subjective ones", () => {
    const opts = (labels, correct) => labels.map((label, i) => ({ id: `o${i}`, option_key: "ABCD"[i], label, is_correct: correct.includes(i), position: i }));
    expect(mapQuestion({ id: "1", type: "mcq", options: opts(["a", "b", "c", "d"], [0, 2]) })).toMatchObject({
      type: "mcq_multi", kind: "objective", correctAnswers: ["A", "C"],
    });
    expect(mapQuestion({ id: "2", type: "fill_blank", options: opts(["Paris"], [0]) })).toMatchObject({
      type: "fill_blank", acceptedAnswer: "Paris",
    });
    const subj = mapQuestion({ id: "3", type: "subjective", options: opts(["Manual grading: see rubric"], [0]) });
    expect(subj).toMatchObject({ type: "subjective", kind: "subjective" });
    expect(subj).not.toHaveProperty("modelAnswer");
  });
});
