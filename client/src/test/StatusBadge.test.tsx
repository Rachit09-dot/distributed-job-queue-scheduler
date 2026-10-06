import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge, PriorityBadge, WorkerStatusBadge } from '../components/ui/StatusBadge';

describe('StatusBadge', () => {
  it('renders QUEUED status', () => {
    render(<StatusBadge status="QUEUED" />);
    expect(screen.getByText('Queued')).toBeInTheDocument();
  });

  it('renders RUNNING status with pulse indicator', () => {
    const { container } = render(<StatusBadge status="RUNNING" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders RETRYING status with pulse indicator', () => {
    const { container } = render(<StatusBadge status="RETRYING" />);
    expect(screen.getByText('Retrying')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders COMPLETED status', () => {
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders FAILED status', () => {
    render(<StatusBadge status="FAILED" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders CANCELLED status', () => {
    render(<StatusBadge status="CANCELLED" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('renders SCHEDULED status', () => {
    render(<StatusBadge status="SCHEDULED" />);
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });
});

describe('PriorityBadge', () => {
  it('renders each priority level', () => {
    const { rerender } = render(<PriorityBadge priority="CRITICAL" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();

    rerender(<PriorityBadge priority="HIGH" />);
    expect(screen.getByText('High')).toBeInTheDocument();

    rerender(<PriorityBadge priority="NORMAL" />);
    expect(screen.getByText('Normal')).toBeInTheDocument();

    rerender(<PriorityBadge priority="LOW" />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });
});

describe('WorkerStatusBadge', () => {
  it('renders ONLINE status', () => {
    render(<WorkerStatusBadge status="ONLINE" />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('renders OFFLINE status', () => {
    render(<WorkerStatusBadge status="OFFLINE" />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders BUSY status', () => {
    render(<WorkerStatusBadge status="BUSY" />);
    expect(screen.getByText('Busy')).toBeInTheDocument();
  });
});
