import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityBar } from './ActivityBar';
import { useEditorStore } from '../../stores/editor';

// Mock the editor store
jest.mock('../../stores/editor', () => ({
  useEditorStore: () => ({
    sidebarPanel: 'explorer',
    setSidebarPanel: jest.fn(),
  }),
}));

describe('ActivityBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ActivityBar />);
    expect(screen.getByRole('region', { name: /activity-bar/i })).toBeInTheDocument();
  });

  it('renders the brand correctly', () => {
    render(<ActivityBar />);
    const brand = screen.getByRole('heading', { level: 2 });
    expect(brand).toHaveTextContent('M');
    expect(brand).toHaveClass('activity-bar-brand');
    expect(brand).toHaveAttribute('title', 'Monnu Clow');
  });

  it('renders all top items', () => {
    render(<ActivityBar />);
    const topItems = screen.getAllByRole('button', { name: /explorer|search|source control|workflows|ai copilot/i });
    expect(topItems).toHaveLength(5);

    // Verify each item has correct icon and label
    expect(screen.getByLabelText('Explorer')).toHaveClass('activity-bar-btn');
    expect(screen.getByLabelText('Search')).toHaveClass('activity-bar-btn');
    expect(screen.getByLabelText('Source Control')).toHaveClass('activity-bar-btn');
    expect(screen.getByLabelText('Workflows')).toHaveClass('activity-bar-btn');
    expect(screen.getByLabelText('AI Copilot')).toHaveClass('activity-bar-btn');
  });

  it('sets active state for current panel', () => {
    // Test with explorer active (default)
    render(<ActivityBar />);
    expect(screen.getByLabelText('Explorer')).toHaveClass('active');
    expect(screen.getByLabelText('Explorer')).toHaveAttribute('aria-pressed', 'true');

    // Test with search active
    (useEditorStore as jest.Mock).mockReturnValueOnce({
      sidebarPanel: 'search',
      setSidebarPanel: jest.fn(),
    });
    render(<ActivityBar />);
    expect(screen.getByLabelText('Search')).toHaveClass('active');
    expect(screen.getByLabelText('Explorer')).not.toHaveClass('active');
  });

  it('shows indicator for active item', () => {
    render(<ActivityBar />);
    const explorerBtn = screen.getByLabelText('Explorer');
    expect(explorerBtn).toContainHTML('<div class="activity-bar-indicator"></div>');

    (useEditorStore as jest.Mock).mockReturnValueOnce({
      sidebarPanel: 'git',
      setSidebarPanel: jest.fn(),
    });
    render(<ActivityBar />);
    const gitBtn = screen.getByLabelText('Source Control');
    expect(gitBtn).toContainHTML('<div class="activity-bar-indicator"></div>');
    expect(screen.getByLabelText('Explorer')).not.toContainHTML('activity-bar-indicator');
  });

  it('calls setSidebarPanel when top item is clicked', () => {
    const setSidebarPanel = jest.fn();
    (useEditorStore as jest.Mock).mockReturnValueOnce({
      sidebarPanel: 'explorer',
      setSidebarPanel,
    });
    render(<ActivityBar />);

    fireEvent.click(screen.getByLabelText('Search'));
    expect(setSidebarPanel).toHaveBeenCalledWith('search');

    fireEvent.click(screen.getByLabelText('Workflows'));
    expect(setSidebarPanel).toHaveBeenCalledWith('workflows');
  });

  it('renders settings button correctly', () => {
    render(<ActivityBar />);
    const settingsBtn = screen.getByLabelText('Settings');
    expect(settingsBtn).toHaveClass('activity-bar-btn');
    expect(settingsBtn).toHaveAttribute('title', 'Settings');
    expect(settingsBtn).toHaveAttribute('aria-label', 'Settings');
  });

  it('calls setSidebarPanel with extensions when settings is clicked', () => {
    const setSidebarPanel = jest.fn();
    (useEditorStore as jest.Mock).mockReturnValueOnce({
      sidebarPanel: 'explorer',
      setSidebarPanel,
    });
    render(<ActivityBar />);

    fireEvent.click(screen.getByLabelText('Settings'));
    expect(setSidebarPanel).toHaveBeenCalledWith('extensions');
  });

  it('handles inactive state correctly when panel is extensions', () => {
    (useEditorStore as jest.Mock).mockReturnValueOnce({
      sidebarPanel: 'extensions',
      setSidebarPanel: jest.fn(),
    });
    render(<ActivityBar />);

    // No top item should be active
    const topButtons = screen.getAllByRole('button', { name: /explorer|search|source control|workflows|ai copilot/i });
    topButtons.forEach(btn => {
      expect(btn).not.toHaveClass('active');
      expect(btn).not.toContainHTML('activity-bar-indicator');
    });

    // Settings button should not be active (it's not in top items)
    const settingsBtn = screen.getByLabelText('Settings');
    expect(settingsBtn).not.toHaveClass('active');
  });

  it('renders correct number of icons', () => {
    render(<ActivityBar />);
    // 5 top items + 1 settings = 6 icons total
    const icons = screen.getAllByRole('img');
    expect(icons).toHaveLength(6);
  });
});