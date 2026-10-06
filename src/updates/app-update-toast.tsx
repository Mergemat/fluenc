import { X } from "lucide-react";

import "./updates.css";

export function AppUpdateToast({
  updating,
  saving,
  onRefresh,
  onDismiss,
}: {
  updating: boolean;
  saving: boolean;
  onRefresh: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="app-update-toast">
      <span role="status">
        {updating ? "Refreshing…" : "Refresh to update"}
      </span>
      <button
        className="app-update-refresh"
        disabled={updating || saving}
        onClick={onRefresh}
        type="button"
      >
        Refresh
      </button>
      <button
        aria-label="Dismiss update"
        className="app-update-dismiss"
        disabled={updating}
        onClick={onDismiss}
        type="button"
      >
        <X size={16} />
      </button>
    </div>
  );
}
