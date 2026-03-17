import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AutoPilotControl } from './AutoPilotControl';

// Mock the dashboard store
jest.mock('../../stores/dashboard', () => ({
  useDashboardStore: () => ({
    autoPilotEnabled: false,
    setAutoPilotEnabled: jest.fn(),
    sendMessage: jest.fn(),
  }),
}));

import { useDashboardStore } from '../../stores/dashboard';

describe('AutoPilotControl', () => {
  const mockStore = useDashboardStore() as jest.Mocked<typeof useDashboardStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.autoPilotEnabled = false;
    mockStore.setAutoPilotEnabled.mockReset();
    mockStore.sendMessage.mockReset();
  });

  describe('Rendering', () => {
    test('renders in disabled state by default', () => {
      render(<AutoPilotControl />);

      // Card should not have enabled class
      const card = screen.getByRole('region');
      expect(card).not.toHaveClass('enabled');

      // Should show manual control text
      expect(screen.getByText(/manual control active/i)).toBeInTheDocument();
      expect(screen.getByText(/pipeline actions require user initialization/i)).toBeInTheDocument();

      // Should not show autopilot metrics
      expect(screen.queryByText(/efficiency:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/active goal:/i)).not.toBeInTheDocument();

      // Should show info box
      expect(screen.getByText(/auto-pilot ensures the system never stops/i)).toBeInTheDocument();
    });

    test('renders in enabled state when autoPilotEnabled is true', () => {
      mockStore.autoPilotEnabled = true;
      render(<AutoPilotControl />);

      // Card should have enabled class
      const card = screen.getByRole('region');
      expect(card).toHaveClass('enabled');

      // Should show autonomous mode text
      expect(screen.getByText(/autonomous mode active/i)).toBeInTheDocument();
      expect(screen.getByText(/supervisor will continuously evaluate/i)).toBeInTheDocument();

      // Should show autopilot metrics
      expect(screen.getByText(/efficiency:/i)).toBeInTheDocument();
      expect(screen.getByText(/active goal:/i)).toBeInTheDocument();

      // Should still show info box
      expect(screen.getByText(/auto-pilot ensures the system never stops/i)).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    test('toggles auto-pilot when checkbox is changed', () => {
      render(<AutoPilotControl />);
      const checkbox = screen.getByLabelText(/toggle auto-pilot mode/i);

      // Initial state: unchecked
      expect(checkbox).not.toBeChecked();

      // Check the box
      fireEvent.change(checkbox, { target: { checked: true } });

      // Should call store methods
      expect(mockStore.setAutoPilotEnabled).toHaveBeenCalledWith(true);
      expect(mockStore.sendMessage).toHaveBeenCalledWith('autopilot:toggle', { enabled: true });

      // Uncheck the box
      fireEvent.change(checkbox, { target: { checked: false } });
      expect(mockStore.setAutoPilotEnabled).toHaveBeenCalledWith(false);
      expect(mockStore.sendMessage).toHaveBeenCalledWith('autopilot:toggle', { enabled: false });
    });

    test('calls sendMessage with correct payload on toggle', () => {
      render(<AutoPilotControl />);
      const checkbox = screen.getByLabelText(/toggle auto-pilot mode/i);

      fireEvent.change(checkbox, { target: { checked: true } });
      expect(mockStore.sendMessage).toHaveBeenCalledWith('autopilot:toggle', { enabled: true });

      fireEvent.change(checkbox, { target: { checked: false } });
      expect(mockStore.sendMessage).toHaveBeenCalledWith('autopilot:toggle', { enabled: false });
    });
  });

  describe('Conditional Rendering', () => {
    test('does not render metrics when disabled', () => {
      render(<AutoPilotControl />);
      expect(screen.queryByText(/efficiency:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/active goal:/i)).not.toBeInTheDocument();
    });

    test('renders metrics when enabled', () => {
      mockStore.autoPilotEnabled = true;
      render(<AutoPilotControl />);
      expect(screen.getByText(/efficiency:/i)).toBeInTheDocument();
      expect(screen.getByText(/active goal:/i)).toBeInTheDocument();
    });

    test('shows different text based on autoPilotEnabled state', () => {
      // Disabled state
      render(<AutoPilotControl />);
      expect(screen.getByText(/manual control active/i)).toBeInTheDocument();
      expect(screen.queryByText(/autonomous mode active/i)).not.toBeInTheDocument();

      // Enabled state
      mockStore.autoPilotEnabled = true;
      render(<AutoPilotControl />);
      expect(screen.getByText(/autonomous mode active/i)).toBeInTheDocument();
      expect(screen.queryByText(/manual control active/i)).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles rapid toggle changes', () => {
      render(<AutoPilotControl />);
      const checkbox = screen.getByLabelText(/toggle auto-pilot mode/i);

      // Rapid toggles
      fireEvent.change(checkbox, { target: { checked: true } });
      fireEvent.change(checkbox, { target: { checked: false } });
      fireEvent.change(checkbox, { target: { checked: true } });

      expect(mockStore.setAutoPilotEnabled).toHaveBeenCalledTimes(3);
      expect(mockStore.setAutoPilotEnabled).toHaveBeenNthCalledWith(1, true);
      expect(mockStore.setAutoPilotEnabled).toHaveBeenNthCalledWith(2, false);
      expect(mockStore.setAutoPilotEnabled).toHaveBeenNthCalledWith(3, true);
      expect(mockStore.sendMessage).toHaveBeenCalledTimes(3);
    });

    test('maintains accessibility attributes', () => {
      render(<AutoPilotControl />);
      const checkbox = screen.getByLabelText(/toggle auto-pilot mode/i);
      expect(checkbox).toHaveAttribute('aria-label', 'Toggle Auto-Pilot Mode');
      expect(checkbox).toHaveAttribute('title', 'Toggle Auto-Pilot Mode');
    });
  });
});