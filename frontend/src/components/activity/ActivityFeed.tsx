import Icon from '../Icon'
import type { ActivityLogResponse } from '../../types/activityLog'
import { activityIcon, activitySentence, exactTime, timeAgo } from '../../utils/activityLog'

type ActivityFeedProps = {
  entries: ActivityLogResponse[]
  /** Tighter spacing for the dashboard panel, roomier for the full page. */
  compact?: boolean
}

/**
 * A list of log entries, rendered as sentences.
 *
 * Shared by the Activity page and the dashboard panel so the two cannot drift -
 * the panel is a preview of the page, and it stops being one the moment they
 * word an entry differently.
 *
 * Renders parts rather than a pre-built string, which is what lets the subject
 * be emphasised without utils/activityLog having to emit markup. See the note
 * on ActivitySentence.
 */
export default function ActivityFeed({ entries, compact = false }: ActivityFeedProps) {
  return (
    <div className="flex flex-col">
      {entries.map((entry) => {
        const sentence = activitySentence(entry)

        return (
          <div
            key={entry.id}
            className={`flex items-start gap-3 border-b border-outline last:border-b-0 ${
              compact ? 'px-5 py-3' : 'px-5 py-4'
            }`}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-low text-on-surface-variant">
              <Icon name={activityIcon(entry)} className="text-[18px]" />
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm text-on-surface-variant">
                {/*
                  The actor. Null only when their row was deleted, which no
                  route can currently do - but the log outlives the person, so
                  the fallback is not decoration.
                */}
                <span className="font-semibold text-on-surface">
                  {entry.user?.display_name ?? 'A removed user'}
                </span>{' '}
                {sentence.verb}
                {sentence.resourceLabel && ` ${sentence.resourceLabel}`}
                {sentence.subject && (
                  <>
                    {' '}
                    <span className="font-medium text-on-surface">{sentence.subject}</span>
                  </>
                )}
                {sentence.suffix && ` ${sentence.suffix}`}
              </p>

              {/*
                Relative time, with the exact stamp on hover. A feed is read as
                "what happened recently", and an absolute timestamp makes the
                reader do the subtraction - but the precise moment is what an
                audit trail is for, so it stays one hover away.
              */}
              <p className="text-xs text-muted" title={exactTime(entry.created_at)}>
                {timeAgo(entry.created_at)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
