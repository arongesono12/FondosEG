-- ============================================
-- Migration: Add read status to notifications
-- Run this in Supabase SQL Editor
-- ============================================

-- Add columns for read/unread status
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Create function to mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(notification_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.notifications 
  SET is_read = TRUE, 
      read_at = NOW()
  WHERE id = notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to mark all notifications as read for a transfer
DROP FUNCTION IF EXISTS public.mark_transfer_notifications_read(UUID);
CREATE OR REPLACE FUNCTION public.mark_transfer_notifications_read(transfer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.notifications 
  SET is_read = TRUE, 
      read_at = NOW()
  WHERE public.notifications.transfer_id = transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to get unread count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(agent_id UUID)
RETURNS INTEGER AS $$
DECLARE
  count_val INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO count_val
  FROM public.notifications n
  JOIN public.transfers t ON n.transfer_id = t.id
  WHERE t.agent_id = agent_id
  AND (n.is_read IS NULL OR n.is_read = FALSE);
  
  RETURN count_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add unique constraint for notifications to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_notification'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
    ADD CONSTRAINT unique_notification UNIQUE (transfer_id, phone);
  END IF;
END
$$;
