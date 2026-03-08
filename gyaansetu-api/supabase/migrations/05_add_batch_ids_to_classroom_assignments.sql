-- Migration: Add batch_ids column to classroom_assignments
-- Run this in your Supabase SQL Editor

ALTER TABLE public.classroom_assignments
ADD COLUMN IF NOT EXISTS batch_ids UUID[] DEFAULT NULL;

COMMENT ON COLUMN public.classroom_assignments.batch_ids IS 'Optional array of batch UUIDs this assignment targets. NULL means visible to all batches.';
