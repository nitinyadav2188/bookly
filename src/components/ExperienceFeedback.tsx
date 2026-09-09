"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import {
  bumpFeedbackVisit,
  getFeedbackVisitCount,
  isFeedbackBlocked,
  PAGE_FLIP_EVENT,
  READER_CLOSE_EVENT,
  READER_OPEN_EVENT,
  saveFeedbackSubmission,
  snoozeFeedback,
  type FeedbackTrigger,
} from "@/lib/feedback";

const EMOJI_SCALE = [
  { value: 1, label: "Rough", emoji: "😞" },
  { value: 2, label: "Meh", emoji: "😕" },
  { value: 3, label: "Okay", emoji: "😐" },
  { value: 4, label: "Good", emoji: "🙂" },
  { value: 5, label: "Fire", emoji: "🤩" },
] as const;

/** Dwell in reader before offering feedback (ms). */
const READER_DWELL_MS = 60_000;
/** On a return visit, wait on home before offering (ms). */
const RETURN_VISIT_MS = 50_000;
/** Never interrupt the boot splash / first paint (~2s hold + fade). */
const POST_SPLASH_MS = 4000;

function tryShowAllowed(): boolean {
  return !isFeedbackBlocked();
}

/**
 * Non-blocking experience popup for NITIN YADAV.
 * Triggers: first real page flip, ~60s in reader, or ~50s on a 2nd+ visit.
 * Analytics custom event + local IndexedDB/localStorage log. No API.
 */
export function ExperienceFeedback() {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [thanks, setThanks] = useState(false);
  const triggerRef = useRef<FeedbackTrigger>("dwell");
  const shownRef = useRef(false);
  const dwellTimerRef = useRef<number | null>(null);
  const returnTimerRef = useRef<number | null>(null);
  const readyRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (dwellTimerRef.current != null) {
      window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
    if (returnTimerRef.current != null) {
      window.clearTimeout(returnTimerRef.current);
      returnTimerRef.current = null;
    }
  }, []);

  const offer = useCallback((trigger: FeedbackTrigger) => {
    if (shownRef.current || !readyRef.current || !tryShowAllowed()) return;
    // Don't stack over other dialogs if one is already open
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    shownRef.current = true;
    triggerRef.current = trigger;
    clearTimers();
    setOpen(true);
  }, [clearTimers]);

  useEffect(() => {
    const boot = window.setTimeout(() => {
      readyRef.current = true;
      bumpFeedbackVisit();
      const visits = getFeedbackVisitCount();
      // Return visit: soft prompt after a calm wait on home (not during first paint).
      if (visits >= 2 && tryShowAllowed()) {
        returnTimerRef.current = window.setTimeout(() => {
          offer("return-visit");
        }, RETURN_VISIT_MS);
      }
    }, POST_SPLASH_MS);

    const onFlip = () => offer("flip");
    const onReaderOpen = () => {
      if (dwellTimerRef.current != null) window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = window.setTimeout(() => {
        offer("dwell");
      }, READER_DWELL_MS);
    };
    const onReaderClose = () => {
      if (dwellTimerRef.current != null) {
        window.clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
    };

    window.addEventListener(PAGE_FLIP_EVENT, onFlip);
    window.addEventListener(READER_OPEN_EVENT, onReaderOpen);
    window.addEventListener(READER_CLOSE_EVENT, onReaderClose);

    return () => {
      window.clearTimeout(boot);
      clearTimers();
      window.removeEventListener(PAGE_FLIP_EVENT, onFlip);
      window.removeEventListener(READER_OPEN_EVENT, onReaderOpen);
      window.removeEventListener(READER_CLOSE_EVENT, onReaderClose);
    };
  }, [offer, clearTimers]);

  const closeForSession = useCallback(() => {
    snoozeFeedback();
    setOpen(false);
    setThanks(false);
    setRating(null);
    setComment("");
  }, []);

  const onDismiss = useCallback(() => {
    try {
      track("experience_feedback_dismiss", { trigger: triggerRef.current });
    } catch {
      // analytics optional offline
    }
    closeForSession();
  }, [closeForSession]);

  const onSubmit = useCallback(async () => {
    if (rating == null || submitting) return;
    setSubmitting(true);
    try {
      await saveFeedbackSubmission(rating, comment, triggerRef.current);
      try {
        track("experience_feedback", {
          rating,
          hasComment: comment.trim().length > 0,
          trigger: triggerRef.current,
        });
      } catch {
        // ignore
      }
      snoozeFeedback();
      setThanks(true);
      window.setTimeout(() => {
        setOpen(false);
        setThanks(false);
        setRating(null);
        setComment("");
      }, 1100);
    } finally {
      setSubmitting(false);
    }
  }, [rating, comment, submitting]);

  if (!open) return null;

  return (
    <div
      className="feedback-backdrop fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Dismiss feedback"
        className="absolute inset-0 bg-black/35"
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="feedback-panel relative w-full max-w-md border-[3px] border-black bg-cream p-5 shadow-[8px_8px_0_#000] sm:p-6"
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <p className="font-mono-label text-[10px] font-bold text-black/55">For NITIN YADAV</p>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 min-w-11 border-[3px] border-black bg-white px-2.5 font-display text-sm shadow-[3px_3px_0_#000]"
            aria-label="Close"
          >
            X
          </button>
        </div>

        {thanks ? (
          <div className="py-6 text-center">
            <p className="font-display text-2xl text-black">Thanks — locked in.</p>
            <p className="mt-2 text-sm text-ink-muted">Your vibe helps Página get better.</p>
          </div>
        ) : (
          <>
            <h2 id={titleId} className="mt-1 font-display text-2xl leading-none text-black sm:text-[1.75rem]">
              How&apos;s Página feeling?
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Quick check-in — rating + optional tea. No account, no spam.
            </p>

            <div
              className="mt-5 flex flex-wrap justify-between gap-2"
              role="group"
              aria-label="Rating from 1 to 5"
            >
              {EMOJI_SCALE.map((item) => {
                const selected = rating === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setRating(item.value)}
                    aria-pressed={selected}
                    aria-label={`${item.value}: ${item.label}`}
                    className={`flex min-h-14 min-w-[3.25rem] flex-1 flex-col items-center justify-center border-[3px] border-black px-1 py-2 shadow-[3px_3px_0_#000] transition-none ${
                      selected ? "bg-lime" : "bg-white hover:bg-blue hover:text-white"
                    }`}
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      {item.emoji}
                    </span>
                    <span className="mt-1 font-mono-label text-[9px] font-bold">{item.value}</span>
                  </button>
                );
              })}
            </div>

            <label className="mt-5 block">
              <span className="font-mono-label text-[10px] font-bold text-black/55">
                Spill the tea — what&apos;s working? (optional)
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Flip feels smooth… zoom is mid… love the lime…"
                className="mt-2 w-full resize-y border-[3px] border-black bg-white px-3 py-3 text-sm text-black shadow-[4px_4px_0_#3b5bff] placeholder:text-black/35 focus:outline-none focus:ring-0"
              />
            </label>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                disabled={rating == null || submitting}
                onClick={() => void onSubmit()}
                className="nb-btn nb-btn-lime min-h-12 w-full text-sm sm:flex-1"
              >
                {submitting ? "Sending…" : "Submit"}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="nb-btn nb-btn-white min-h-12 w-full text-sm sm:flex-1"
              >
                Not now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
