import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ZoomComparisonModal from './ZoomComparisonModal';

describe('ZoomComparisonModal', () => {
  let onCloseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCloseMock = vi.fn();
  });

  afterEach(() => {
    // Clean up body overflow style
    document.body.style.overflow = '';
  });

  describe('Conditional Rendering (Requirement 10.4)', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <ZoomComparisonModal isOpen={false} onClose={onCloseMock} />
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
      render(<ZoomComparisonModal isOpen={true} onClose={onCloseMock} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Full-screen Modal Layout (Requirement 4.1)', () => {
    it('should render with full-screen backdrop', () => {
      render(<ZoomComparisonModal isOpen={true} onClose={onCloseMock} />);
      
      const backdrop = screen.getByRole('dialog');
      expect(backdrop).toHaveClass('fixed', 'inset-0', 'z-50');
    });

    it('should have modal attributes', () => {
      render(<ZoomComparisonModal isOpen={true} onClose={onCloseMock} />);
      
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('should prevent body scroll when open', () => {
      render(<ZoomComparisonModal isOpen={true} onClose={onCloseMock} />);
      
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when closed', () => {
      const { rerender } = render(
        <ZoomComparisonModal isOpen={true} onClose={onCloseMock} />
      );
      
      expect(document.body.style.overflow).toBe('hidden');
      
      rerender(<ZoomComparisonModal isOpen={false} onClose={onCloseMock} />);
      
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Close Button (Requirement 4.6)', () => {
    it('should render close button', () => {
      render(<ZoomComparisonModal isOpen={true} onClose={onCloseMock} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
      render(<ZoomComparisonModal isOpen={true} onClose={onCloseMock} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);
      
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('should be keyboard accessible', () => {
      render(<ZoomComparisonModal isOpen={true} onClose={onCloseMock} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('ESC Key Handler (Requirement 4.5)', () => {
    it('should call onClose when ESC key is pressed', () => {
      render(<ZoomComparisonModal isOpen={true} onClose={onCloseMock} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose for other keys', () => {
      render(<ZoomComparisonModal isOpen={true} onClose={onCloseMock} />);
      
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Space' });
      fireEvent.keyDown(document, { key: 'a' });
      
      expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('should not register ESC handler when modal is closed', () => {
      render(<ZoomComparisonModal isOpen={false} onClose={onCloseMock} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('should clean up event listener on unmount', () => {
      const { unmount } = render(
        <ZoomComparisonModal isOpen={true} onClose={onCloseMock} />
      );
      
      unmount();
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  describe('Backdrop Click (Requirement 4.1)', () => {
    it('should call onClose when backdrop is clicked', () => {
      render(<ZoomComparisonModal isOpen={true} onClose={onCloseMock} />);
      
      const backdrop = screen.getByRole('dialog');
      fireEvent.click(backdrop);
      
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when modal content is clicked', () => {
      render(<ZoomComparisonModal isOpen={true} onClose={onCloseMock} />);
      
      const modalContent = screen.getByRole('dialog').querySelector('div > div');
      expect(modalContent).toBeInTheDocument();
      
      if (modalContent) {
        fireEvent.click(modalContent);
      }
      
      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });
});
