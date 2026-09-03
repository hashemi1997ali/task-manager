import type { PipelineStage, QueryFilter } from "mongoose";

import type { ITask } from "#models";

export const createDueDateSortPipeline = (
  filter: QueryFilter<ITask>,
  order: 1 | -1,
  skip: number,
  limit: number,
): PipelineStage[] => [
  { $match: filter },
  {
    $addFields: {
      __dueDateMissing: {
        $cond: [{ $eq: [{ $type: "$dueDate" }, "date"] }, 0, 1],
      },
    },
  },
  { $sort: { __dueDateMissing: 1, dueDate: order, _id: order } },
  { $skip: skip },
  { $limit: limit },
  { $project: { __dueDateMissing: 0 } },
];
