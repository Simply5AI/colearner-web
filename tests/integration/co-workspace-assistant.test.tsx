import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoWorkspaceAssistant } from '@/components/co/co-workspace-assistant'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { MaterialIdentityProvider } from '@/components/materials/material-identity'
import { workspaceCoContext } from '@/components/co/workspace-help'

const api = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'adult-session' } } }) }))
vi.mock('@/lib/api/materials', () => ({ materialApi: api }))
vi.mock('@/components/co/co-panel', () => ({ AskCoPanel: (props: { context: unknown; actor: string; onOpenChange: (open: boolean) => void }) => <div role="dialog" aria-label="Learning chat"><p>{JSON.stringify(props.context)}</p><p>{props.actor}</p><button onClick={() => props.onOpenChange(false)}>Close learning chat</button></div> }))
function show(pathname = '/learn/import', child = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const content = <CoWorkspaceAssistant band="teens" pathname={pathname} />
  render(<QueryClientProvider client={client}>{child ? <MaterialIdentityProvider scope="child-profile">{content}</MaterialIdentityProvider> : <LearnIdentityProvider scope="learner" band="teens">{content}</LearnIdentityProvider>}</QueryClientProvider>)
}
beforeEach(() => { vi.clearAllMocks(); api.list.mockResolvedValue({ items: [{ id: 'source-one', title: 'Science notes' }] }) })
afterEach(cleanup)

describe('Co from the student header', () => {
  it('opens screen guidance, answers navigation questions and restores focus on close', async () => {
    show(); const trigger = screen.getByRole('button', { name: 'Ask Co' });
    expect(api.list).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Ask Co' });
    expect(within(dialog).getByRole('heading', { name: 'Add learning material' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Ask how to use CoLearner'), { target: { value: 'How do I practise?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask about CoLearner' }));
    expect(screen.getByRole('heading', { name: 'Your practice' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close Ask Co' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it('opens existing AI chat with the current lesson context', async () => {
    show('/learn/lesson/lesson-one'); fireEvent.click(screen.getByRole('button', { name: 'Ask Co' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ask about this lesson' }));
    expect(screen.getByRole('dialog', { name: 'Learning chat' })).toHaveTextContent('"lessonId":"lesson-one"');
  });
  it('uses the selected child identity when launched from a material screen', async () => {
    show('/learn/library', true); fireEvent.click(screen.getByRole('button', { name: 'Ask Co' }));
    await screen.findByRole('option', { name: 'Science notes' });
    fireEvent.change(screen.getByLabelText('Material to ask Co about'), { target: { value: 'source-one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start learning chat' }));
    expect(screen.getByRole('dialog', { name: 'Learning chat' })).toHaveTextContent('child-profile');
  });
  it('keeps screen help available when the material service fails', async () => {
    api.list.mockRejectedValue(new Error('unavailable')); show(); fireEvent.click(screen.getByRole('button', { name: 'Ask Co' }));
    expect(await screen.findByText('Your materials could not load.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ask about CoLearner' })).toBeVisible();
  });
  it('does not turn new-lesson routes or arbitrary paths into source identifiers', () => {
    expect(workspaceCoContext('/learn/lesson/new')).toBeNull();
    expect(workspaceCoContext('/learn/library/id/private')).toBeNull();
    expect(workspaceCoContext('/learn/library/source-one')).toEqual({ kind: 'MATERIAL', materialId: 'source-one' });
  });
});
