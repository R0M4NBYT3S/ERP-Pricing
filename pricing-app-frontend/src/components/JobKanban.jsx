import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const STATUSES = [
  "order_received",
  "priced",
  "cut_sheet_generated",
  "cnc_nesting",
  "sent_to_shop",
  "cnc_cutting",
  "fold",
  "assembly",
  "powdercoat",
  "storage",
  "delivery_scheduled",
  "delivered",
];

export default function JobKanban() {
  const [jobs, setJobs] = useState([]);

  // Load jobs from backend
  useEffect(() => {
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data) => setJobs(data))
      .catch((err) => console.error("Error loading jobs:", err));
  }, []);

  // Handle drag-and-drop updates
  async function handleDragEnd(result) {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const newStatus = destination.droppableId;

    try {
      const res = await fetch(`/api/jobs/${draggableId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes: "Moved via Kanban" }),
      });
      if (res.ok) {
        const updatedJob = await res.json();
        setJobs((prev) =>
          prev.map((job) => (job.id === updatedJob.id ? updatedJob : job))
        );
      }
    } catch (err) {
      console.error("Error updating job:", err);
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-4 gap-4 p-4 overflow-x-auto">
        {STATUSES.map((status) => (
          <Droppable droppableId={status} key={status}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`bg-gray-100 rounded-lg p-2 min-h-[400px] flex flex-col ${
                  snapshot.isDraggingOver ? "bg-blue-100" : ""
                }`}
              >
                <h2 className="font-bold text-center mb-2 capitalize">
                  {status.replaceAll("_", " ")}
                </h2>

                {jobs
                  .filter((j) => j.status === status)
                  .map((job, idx) => (
                    <Draggable
                      key={job.id}
                      draggableId={job.id}
                      index={idx}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`bg-white rounded shadow p-2 mb-2 cursor-pointer ${
                            snapshot.isDragging ? "bg-blue-50" : ""
                          }`}
                        >
                          <p className="font-semibold">{job.customer_name}</p>
                          <p className="text-xs">{job.product_type}</p>
                          <p className="text-xs">PO: {job.po_number || "N/A"}</p>
                          <p className="text-xs text-gray-500">
                            {job.created_at
                              ? new Date(job.created_at).toLocaleDateString()
                              : ""}
                          </p>
                        </div>
                      )}
                    </Draggable>
                  ))}

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
