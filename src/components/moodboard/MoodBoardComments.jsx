import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CommentThread from "@/components/comments/CommentThread";

export default function MoodBoardComments({ open, onClose, projectId, targetId, staff }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Comments</DialogTitle></DialogHeader>
        {targetId && <CommentThread projectId={projectId} targetType="mood_board" targetId={targetId} staff={staff} title="" />}
      </DialogContent>
    </Dialog>
  );
}