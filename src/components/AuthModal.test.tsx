import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthModal from './AuthModal'; // Changed to default import
import { useAppStore } from '../store/useAppStore';
import { backendAPI } from '../utils/backendAPI';

// Mock dependencies
jest.mock('../store/useAppStore');
jest.mock('../utils/backendAPI');

const mockSetAuthModalOpen = jest.fn();
const mockLogin = jest.fn();
const mockRegister = jest.fn();
const mockClearAuthError = jest.fn();

const mockOnClose = jest.fn();

describe('AuthModal', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockOnClose.mockClear();
    mockSetAuthModalOpen.mockClear();
    mockLogin.mockClear();
    mockRegister.mockClear();
    mockClearAuthError.mockClear();

    (useAppStore as jest.Mock).mockReturnValue({
      isAuthModalOpen: true, // This is for the store, AuthModal component itself uses isOpen prop
      authError: null,
      setAuthModalOpen: mockSetAuthModalOpen, // This might be used if the modal closes itself via store
      login: mockLogin,
      register: mockRegister,
      clearAuthError: mockClearAuthError,
      addNotification: jest.fn(), // Added addNotification mock
    });

    (backendAPI.login as jest.Mock).mockResolvedValue({ token: 'test-token', user: { id: '1', name: 'Test User', email: 'test@example.com' } });
    (backendAPI.register as jest.Mock).mockResolvedValue({ message: 'Success', user: { id: '1', name: 'Test User', email: 'test@example.com' } });
  });

  test('renders the login form by default', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByRole('heading', { name: /Welcome Back/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByText(/Don't have an account?/i)).toBeInTheDocument();
  });

  test('renders the registration form when mode is switched to register', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    // Click the "Sign up" button to switch to register mode
    fireEvent.click(screen.getByRole('button', { name: /Sign up/i }));
    expect(screen.getByRole('heading', { name: /Create Account/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your full name/i)).toBeInTheDocument(); // Corrected placeholder
    expect(screen.getByPlaceholderText(/Enter your email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Confirm your password/i)).toBeInTheDocument(); // Confirm password field
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
    expect(screen.getByText(/Already have an account?/i)).toBeInTheDocument();
  });

  test('input fields can be typed into (login mode)', async () => {
    const user = userEvent.setup();
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    const emailInput = screen.getByPlaceholderText(/Enter your email/i);
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);

    await user.type(emailInput, 'test@example.com');
    expect(emailInput).toHaveValue('test@example.com');

    await user.type(passwordInput, 'password123');
    expect(passwordInput).toHaveValue('password123');
  });

  test('input fields can be typed into (register mode)', async () => {
    const user = userEvent.setup();
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Sign up/i }));

    const nameInput = screen.getByPlaceholderText(/Enter your full name/i); // Corrected placeholder
    const emailInput = screen.getByPlaceholderText(/Enter your email/i);
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/Confirm your password/i);

    await user.type(nameInput, 'Test User');
    expect(nameInput).toHaveValue('Test User');

    await user.type(emailInput, 'test@example.com');
    expect(emailInput).toHaveValue('test@example.com');

    await user.type(passwordInput, 'password123');
    expect(passwordInput).toHaveValue('password123');

    await user.type(confirmPasswordInput, 'password123');
    expect(confirmPasswordInput).toHaveValue('password123');
  });

  test('login form submission calls login function', async () => {
    const user = userEvent.setup();
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);

    const emailInput = screen.getByPlaceholderText(/Enter your email/i);
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
    const signInButton = screen.getByRole('button', { name: /Sign In/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(signInButton);

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  test('registration form submission calls register function', async () => {
    const user = userEvent.setup();
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Sign up/i })); // Switch to register

    const nameInput = screen.getByPlaceholderText(/Enter your full name/i); // Corrected placeholder
    const emailInput = screen.getByPlaceholderText(/Enter your email/i);
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/Confirm your password/i);
    const createAccountButton = screen.getByRole('button', { name: /Create Account/i });

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'newuser@example.com');
    await user.type(passwordInput, 'newpassword123');
    await user.type(confirmPasswordInput, 'newpassword123');
    await user.click(createAccountButton);

    expect(mockRegister).toHaveBeenCalledWith('newuser@example.com', 'Test User', 'newpassword123'); // Corrected argument order
  });

  test('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    // Find the button that contains the X icon
    // This assumes the X icon is unique for the close button.
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(button => button.querySelector('svg.lucide-x'));

    if (closeButton) {
         await user.click(closeButton);
         expect(mockOnClose).toHaveBeenCalled();
    } else {
        throw new Error("Close button with X icon not found");
    }
  });

  test('displays error message on login failure', async () => {
    const mockLoginWithError = jest.fn().mockRejectedValue(new Error('Invalid credentials'));
    (useAppStore as jest.Mock).mockReturnValue({
      isAuthModalOpen: true,
      authError: null, // Error is handled via catch block in component
      setAuthModalOpen: mockSetAuthModalOpen,
      login: mockLoginWithError, // Use this mock for the specific test
      register: mockRegister,
      clearAuthError: mockClearAuthError,
      addNotification: jest.fn(),
    });
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    const user = userEvent.setup();
    const emailInput = screen.getByPlaceholderText(/Enter your email/i);
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
    const signInButton = screen.getByRole('button', { name: /Sign In/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(signInButton);

    expect(useAppStore().addNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      message: 'Invalid credentials',
    }));
  });

  test('displays error message on registration failure', async () => {
    const mockRegisterWithError = jest.fn().mockRejectedValue(new Error('Email already exists'));
    (useAppStore as jest.Mock).mockReturnValue({
      isAuthModalOpen: true,
      authError: null, // Error is handled via catch block in component
      setAuthModalOpen: mockSetAuthModalOpen,
      login: mockLogin,
      register: mockRegisterWithError, // Use this mock
      clearAuthError: mockClearAuthError,
      addNotification: jest.fn(),
    });
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    const user = userEvent.setup();
    fireEvent.click(screen.getByRole('button', { name: /Sign up/i })); // Switch to register

    const nameInput = screen.getByPlaceholderText(/Enter your full name/i);
    const emailInput = screen.getByPlaceholderText(/Enter your email/i);
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/Confirm your password/i);
    const createAccountButton = screen.getByRole('button', { name: /Create Account/i });

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'existing@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(createAccountButton);

    expect(useAppStore().addNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      message: 'Email already exists',
    }));
  });

  test('clears error when switching modes', async () => {
     // This test needs re-evaluation because errors are now shown via notifications,
     // and form field errors are cleared on input change.
     // The original intent was likely to check if a general authError from store is cleared.
     // Since that's not how the component displays errors, we'll check if setErrors({}) is called.
     // To do this properly, we'd need to spy on useState within the component, which is complex.
     // For now, we'll rely on the visual clearing of field errors (which is implicitly tested by typing)
     // and the fact that `clearAuthError` from the store is called by the component if it were to use it.
     // The component currently calls `setErrors({})` internally when switching modes.

    (useAppStore as jest.Mock).mockReturnValue({
      isAuthModalOpen: true,
      authError: 'Some login error that should be cleared by store', // This is a store error
      setAuthModalOpen: mockSetAuthModalOpen,
      login: mockLogin,
      register: mockRegister,
      clearAuthError: mockClearAuthError,
      addNotification: jest.fn(),
    });

    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    // Simulate an initial field error
    const emailInput = screen.getByPlaceholderText(/Enter your email/i) as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: "invalid" } }); // Trigger validation
    fireEvent.submit(screen.getByRole('button', {name: /Sign In/i})); // Attempt submit to show field error
    expect(screen.getByText('Please enter a valid email')).toBeInTheDocument(); // Field error shown

    // Switch to register mode
    fireEvent.click(screen.getByRole('button', { name: /Sign up/i }));
    // Field errors should be cleared by setErrors({}) in switchMode
    expect(screen.queryByText('Please enter a valid email')).not.toBeInTheDocument();
    // If clearAuthError from store was meant to be called, it would be:
    // expect(mockClearAuthError).toHaveBeenCalled();
    // However, the component's switchMode clears its internal 'errors' state, not the store's 'authError'.
  });

});
