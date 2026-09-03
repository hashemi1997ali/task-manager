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
    <div className="space-y-3">
      {groups.map((group, groupIndex) => (
        <section key={group[0].id} className="flex flex-col gap-3">
          <div
            className={`sticky top-3 z-10 w-28 self-center whitespace-nowrap ${
              groupIndex === 0 ? "mb-3" : ""
            }`}
          >
            <time
              dateTime={group[0].createdAt}
              className="block w-full rounded-full border border-[color-mix(in_srgb,var(--border)_72%,transparent)] bg-[var(--surface)] px-3 py-1 text-center text-xs font-semibold text-[var(--muted)]"
            >
              {formatDate(group[0].createdAt)}
            </time>
          </div>
          {group.map((item) => (
            <div key={item.id}>{renderItem(item)}</div>
          ))}
        </section>
      ))}
    </div>
  );
}
