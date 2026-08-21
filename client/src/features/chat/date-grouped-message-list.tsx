import type { ReactNode } from "react";

type DatedItem = {
  id: string;
  createdAt: string;
};

type DateGroupedMessageListProps<T extends DatedItem> = {
  items: T[];
  formatDate: (value: string) => string;
  renderItem: (item: T) => ReactNode;
};

export function DateGroupedMessageList<T extends DatedItem>({
  items,
  formatDate,
  renderItem,
}: DateGroupedMessageListProps<T>) {
  const groups = items.reduce<T[][]>((result, item) => {
    const previousGroup = result.at(-1);
    const previousItem = previousGroup?.at(-1);
    const itemDate = new Date(item.createdAt).toDateString();
    const previousDate = previousItem
      ? new Date(previousItem.createdAt).toDateString()
      : null;

    if (!previousGroup || itemDate !== previousDate) {
      result.push([item]);
    } else {
      previousGroup.push(item);
    }

    return result;
  }, []);

  return (
    <div className="space-y-4 py-3">
      {groups.map((group, groupIndex) => (
        <section key={group[0].id} className="flex flex-col gap-3.5">
          <div
            className={`sticky top-2 z-10 flex w-full items-center gap-3 self-center whitespace-nowrap ${groupIndex === 0 ? "mb-2" : "mt-2"}`}
          >
            <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,var(--border))]" />
            <time
              dateTime={group[0].createdAt}
              className="block rounded-full border bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-3 py-1 text-center text-[0.625rem] font-semibold tracking-wide text-[var(--muted)] shadow-sm backdrop-blur-xl"
            >
              {formatDate(group[0].createdAt)}
            </time>
            <span className="h-px flex-1 bg-[linear-gradient(90deg,var(--border),transparent)]" />
          </div>
          {group.map((item) => (
            <div key={item.id}>{renderItem(item)}</div>
          ))}
        </section>
      ))}
    </div>
  );
}
