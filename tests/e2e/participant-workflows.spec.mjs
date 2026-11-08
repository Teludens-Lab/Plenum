import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { fixture } from './fixture.mjs';
const evidence = 'output/playwright/participant-workflows';
test.beforeAll(async () => mkdir(evidence, { recursive: true }));

async function actor(browser, token, role) {
  const context = await browser.newContext();
  const authorization = { Authorization: `Bearer ${token}` };
  // Application credentials must never override the media provider's WebSocket credential.
  await context.route(`${test.info().project.use.baseURL}/v1/**`, route => route.continue({ headers: { ...route.request().headers(), ...authorization } }));
  const deviceId = (await (await context.request.post('/v1/devices', { data: {}, headers: authorization })).json()).deviceId;
  const url = `/v1/sessions/${fixture.sessionId}/runtime-projection?activeSessionRoleId=${role}`;
  const read = async (before) => {
    const response = await context.request.get(url + (before === undefined ? '' : `&timelineBefore=${before}`), { headers: { ...authorization, 'x-device-id': deviceId } });
    expect(response.status()).toBe(200); return response.json();
  };
  const send = async (operationType, aggregateId, expectedAggregateVersion, payload) => {
    const response = await context.request.post(`/v1/sessions/${fixture.sessionId}/commands`, { headers: authorization, data: {
      commandId: crypto.randomUUID(), deviceId, operationType, aggregateId, expectedAggregateVersion,
      governingReleaseId: fixture.releaseId, activeSessionRoleId: role, payload
    } });
    return response.json();
  };
  const page = await context.newPage();
  await page.addInitScript(id => localStorage.setItem('plenum.runtime.deviceId', id), deviceId);
  const open = () => page.goto(`/sessions/${fixture.sessionId}/runtime?role=${role}`);
  return { context, page, read, send, open, deviceId, url, authorization };
}

test('Submitted actions and paginated timeline remain team-scoped and read-only for Notetakers', async ({ browser }) => {
  const author = await actor(browser, fixture.tokens.author, 'scribe');
  const note = await actor(browser, fixture.tokens.blueNotetaker, 'notetaker');
  const red = await actor(browser, fixture.tokens.redAuthor, 'scribe');
  try {
    const id = crypto.randomUUID();
    const content = { ownOrientation: 'stabilization', redForecast: 'pressure', forecastActionDescription: 'Synthetic team-scoped forecast.' };
    expect((await author.send('artifact.create', id, 0, { artifactTypeKey: 'blue_strategic_orientation', content })).status).toBe('accepted');
    expect((await note.read()).artifacts.some(a => a.id === id)).toBe(false);
    for (let version = 1; version <= 51; version++) expect((await author.send('artifact.edit', id, version, { content })).status).toBe('accepted');
    expect((await author.send('artifact.submit', id, 52, {})).status).toBe('accepted');
    const projection = await note.read();
    const action = projection.artifacts.find(a => a.id === id);
    expect(action).toBeDefined(); expect(action.actions).toEqual([]);
    expect((await note.send('artifact.edit', id, 53, { content })).status).toBe('rejected');
    expect((await red.read()).artifacts.some(a => a.id === id)).toBe(false);
    expect((await red.read()).timeline.entries.some(e => e.aggregateId === id)).toBe(false);
    expect(projection.timeline.entries.length).toBe(50);
    expect(projection.timeline.nextBefore).not.toBeNull();
    const older = await note.read(projection.timeline.nextBefore);
    expect(older.timeline.entries.some(e => e.aggregateId === id)).toBe(true);
    expect(older.timeline.entries.every(e => e.sequence < projection.timeline.nextBefore)).toBe(true);
    expect(JSON.stringify(projection.timeline)).not.toContain(content.forecastActionDescription);
    expect((await note.context.request.get(`${note.url}&timelineBefore=-1`, { headers: { ...note.authorization, 'x-device-id': note.deviceId } })).status()).toBe(422);
    await note.open();
    await note.page.getByRole('link', { name: 'View Actions', exact: false }).click();
    await expect(note.page.getByText(content.forecastActionDescription, { exact: true })).toBeVisible();
    await expect(note.page.getByRole('button', { name: 'Forward to White Cell', exact: true })).toHaveCount(0);
    await note.page.getByRole('link', { name: 'Session Timeline', exact: false }).click();
    await note.page.getByRole('button', { name: 'Load earlier activity' }).click();
    await expect(note.page.getByRole('status').filter({ hasText: '53 matching events loaded.' })).toBeVisible();
    await note.page.screenshot({ path: `${evidence}/notetaker-timeline.png` });
    expect((await new AxeBuilder({page:note.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  } finally { await Promise.all([author.context.close(), note.context.close(), red.context.close()]); }
});

test('White Cell publishes feed updates through authorized routes; participants cannot publish', async ({ browser }) => {
  const control = await actor(browser, fixture.tokens.finalReviewer, 'white_cell');
  const author = await actor(browser, fixture.tokens.author, 'scribe');
  try {
    for (const channel of ['verba', 'tribe-street-journal']) {
      const text = `Synthetic ${channel} update`;
      expect((await author.send('message.send', crypto.randomUUID(), 0, { routeId: `control-${channel}`, content: { text } })).status).toBe('rejected');
      expect((await control.send('message.send', crypto.randomUUID(), 0, { routeId: `control-${channel}`, content: { text } })).status).toBe('accepted');
      expect((await author.read()).messages.some(m => m.channelId === channel && m.content.text === text)).toBe(true);
    }
    await author.open();
    await author.page.getByRole('link', { name: 'Verba AI Population Sentiments', exact: false }).click();
    await expect(author.page.getByText('Synthetic verba update', { exact: true })).toBeVisible();
    await expect(author.page.getByRole('button', { name: 'Publish update' })).toHaveCount(0);
    await author.page.screenshot({ path: `${evidence}/published-feed.png` });
    expect((await new AxeBuilder({page:author.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  } finally { await Promise.all([control.context.close(), author.context.close()]); }
});

test('Communications targets the selected role and Journal forwards a reviewed capture', async ({ browser }) => {
  const control = await actor(browser, fixture.tokens.finalReviewer, 'white_cell');
  const note = await actor(browser, fixture.tokens.blueNotetaker, 'notetaker');
  const author = await actor(browser, fixture.tokens.author, 'scribe');
  const red = await actor(browser, fixture.tokens.redAuthor, 'scribe');
  try {
    await control.open();
    await control.page.getByRole('link', { name: 'Communications', exact: false }).click();
    await control.page.getByRole('combobox', { name: 'Recipient', exact: true }).selectOption('control-communication-blue-notetaker');
    await control.page.getByLabel('Type', { exact: true }).selectOption('Guidance');
    await control.page.getByRole('textbox', { name: 'Message', exact: true }).fill('Synthetic targeted guidance for the Blue Notetaker.');
    await control.page.getByRole('button', { name: 'Send Communication', exact: true }).click();
    await expect(control.page.getByText('Message sent.', { exact: true })).toBeVisible();
    expect((await note.read()).messages.some(m => m.content.text === 'Synthetic targeted guidance for the Blue Notetaker.')).toBe(true);
    expect((await author.read()).messages.some(m => m.content.text === 'Synthetic targeted guidance for the Blue Notetaker.')).toBe(false);
    expect((await red.read()).messages.some(m => m.content.text === 'Synthetic targeted guidance for the Blue Notetaker.')).toBe(false);
    expect((await author.send('message.send', crypto.randomUUID(), 0, { routeId: 'control-communication-blue-notetaker', content: { text: 'Denied sender' } })).status).toBe('rejected');
    const capture = crypto.randomUUID();
    expect((await note.send('artifact.create', capture, 0, { artifactTypeKey: 'note', content: { kind: 'quote', note: 'Synthetic captured observation to review.' } })).status).toBe('accepted');
    await control.page.reload();
    await control.page.getByRole('link', { name: 'Tribe Street Journal', exact: false }).click();
    await control.page.getByLabel('Captured observation', { exact: true }).selectOption(capture);
    await expect(control.page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(/Synthetic captured observation/);
    await control.page.getByRole('textbox', { name: 'Message', exact: true }).fill('Reviewed synthetic observation for the Session.');
    await control.page.getByRole('button', { name: 'Publish update', exact: true }).click();
    await expect(control.page.getByText('Message sent.', { exact: true })).toBeVisible();
    expect((await red.read()).messages.some(m => m.channelId === 'tribe-street-journal' && m.content.sourceArtifactId === capture && m.content.text === 'Reviewed synthetic observation for the Session.')).toBe(true);
    await control.page.screenshot({ path: `${evidence}/journal-captures.png` });
    expect((await new AxeBuilder({page:control.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  } finally { await Promise.all([control.context.close(), note.context.close(), author.context.close(), red.context.close()]); }
});

test('Simulation Settings preserves Operator assignment and stage command boundaries', async ({ browser }) => {
  const control = await actor(browser, fixture.tokens.finalReviewer, 'white_cell');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const projection = await control.read();
    const settings = projection.modules.find(m => m.type === 'session_status');
    expect(settings.configuration.operatorAccess).toBe(false);
    expect(settings.configuration.stageSchedule.length).toBeGreaterThan(1);
    await control.open();
    await control.page.getByRole('tab', { name: 'Participants', exact: true }).click();
    await expect(control.page.getByText('Session management requires an active Operator assignment.', { exact: false }).filter({ visible: true })).toBeVisible();
    await expect(control.page.getByRole('link', { name: 'Manage participants and seats' })).toHaveCount(0);
    const manage = await control.context.request.get(`/v1/operator/sessions/${fixture.sessionId}`, { headers: control.authorization });
    expect(manage.status()).toBe(403);
    const stage = settings.configuration.stageControl;
    const action = stage.actions.find(a => ['stage.start','stage.pause','stage.resume'].includes(a.operation));
    expect(action).toBeDefined();
    expect((await control.send(action.operation, fixture.sessionId, stage.version, { reason: '' })).status).toBe('rejected');
    expect((await control.send(action.operation, fixture.sessionId, stage.version, { reason: 'Synthetic participant verification' })).status).toBe('accepted');
    expect((await control.send(action.operation, fixture.sessionId, stage.version, { reason: 'Stale version' })).status).not.toBe('accepted');
    // Attach the existing White Cell fixture seat to the already assigned Operator, only in this disposable database.
    await pool.query('UPDATE runtime.participants SET person_id=$1 WHERE organization_id=$2 AND id=$3',
      [fixture.people.operator, fixture.organizationId, fixture.participants.finalReviewer]);
    const operator = await actor(browser, fixture.tokens.operator, 'white_cell');
    try {
      expect((await operator.read()).modules.find(m => m.type === 'session_status').configuration.operatorAccess).toBe(true);
      expect((await operator.context.request.get(`/v1/operator/sessions/${fixture.sessionId}`, { headers: operator.authorization })).status()).toBe(200);
      await operator.open();
      await operator.page.getByRole('tab', { name: 'Participants', exact: true }).click();
      await expect(operator.page.getByRole('heading', { name: 'Active assignments' })).toBeVisible();
      await expect(operator.page.getByRole('button', { name: 'Issue invitation', exact: true })).toBeVisible();
      await operator.page.getByRole('tab', { name: 'Export Data', exact: true }).click();
      await expect(operator.page.getByRole('button', { name: 'Generate and download', exact: true })).toBeVisible();
      expect((await new AxeBuilder({page:operator.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    } finally { await operator.context.close(); }
  } finally {
    await pool.query('UPDATE runtime.participants SET person_id=$1 WHERE organization_id=$2 AND id=$3', [fixture.people.finalReviewer, fixture.organizationId, fixture.participants.finalReviewer]);
    await pool.end(); await control.context.close();
  }
});

test('White Cell revision history shows submitted versions and denies other roles', async ({ browser }) => {
  const author = await actor(browser, fixture.tokens.author, 'scribe');
  const reviewer = await actor(browser, fixture.tokens.reviewer, 'facilitator');
  const control = await actor(browser, fixture.tokens.finalReviewer, 'white_cell');
  const red = await actor(browser, fixture.tokens.redAuthor, 'scribe');
  try {
    const id = crypto.randomUUID();
    const content = { ownOrientation: 'pressure', redForecast: 'reframe', forecastActionDescription: 'Synthetic submitted history.' };
    const history = (who, before='') => who.context.request.get(`/v1/sessions/${fixture.sessionId}/runtime-artifacts/${id}/history?activeSessionRoleId=${who === control ? 'white_cell' : 'scribe'}${before}`,
      { headers: { ...who.authorization, 'x-device-id': who.deviceId } });
    expect((await author.send('artifact.create', id, 0, { artifactTypeKey: 'blue_strategic_orientation', content })).status).toBe('accepted');
    expect((await history(control)).status()).toBe(403);
    expect((await author.send('artifact.submit', id, 1, {})).status).toBe('accepted');
    expect((await reviewer.send('artifact.forward', id, 2, {})).status).toBe('accepted');
    expect((await control.send('artifact.return', id, 3, {})).status).toBe('accepted');
    expect((await author.send('artifact.edit', id, 4, { content: { ...content, forecastActionDescription: 'Unsubmitted revision must stay out of history.' } })).status).toBe('accepted');
    let response = await history(control);
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.revisions.map(r => r.version)).toEqual([4,3]);
    expect(JSON.stringify(result)).not.toContain('Unsubmitted revision');
    expect((await history(author)).status()).toBe(403);
    expect((await history(red)).status()).toBe(403);
    expect((await history(control, '&beforeVersion=-1')).status()).toBe(422);
    expect((await (await history(control, '&beforeVersion=4')).json()).revisions.map(r => r.version)).toEqual([3]);
    await control.open();
    await control.page.getByRole('link', { name: 'Returned/Revision History', exact: false }).click();
    await control.page.getByLabel('Submission', { exact: true }).selectOption(id);
    await control.page.getByText('Version 4 — Returned for revision', { exact: false }).click();
    await expect(control.page.getByText(content.forecastActionDescription, { exact: true }).filter({ visible: true })).toBeVisible();
    await control.page.screenshot({ path: `${evidence}/revision-history.png` });
    expect((await new AxeBuilder({page:control.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  } finally { await Promise.all([author.context.close(), reviewer.context.close(), control.context.close(), red.context.close()]); }
});

test('Voice icon keeps real audio connected while its dialog is closed', async ({ browser }) => {
  test.skip(process.env.MEDIA_TEST_URL === undefined, 'MEDIA_TEST_URL is required for real audio delivery');
  const sender = await actor(browser, fixture.tokens.author, 'scribe');
  const listener = await actor(browser, fixture.tokens.reviewer, 'facilitator');
  try {
    await listener.page.addInitScript(() => {
      const Native = window.RTCPeerConnection;
      window.__participantConnections = [];
      window.RTCPeerConnection = class extends Native {
        constructor(...args) { super(...args); window.__participantConnections.push(this); }
      };
    });
    const received = () => listener.page.evaluate(async () => {
      let packets = 0;
      for (const connection of window.__participantConnections ?? []) for (const stat of (await connection.getStats()).values()) {
        if (stat.type === 'inbound-rtp' && (stat.kind === 'audio' || stat.mediaType === 'audio')) packets += stat.packetsReceived ?? 0;
      }
      return packets;
    });
    await Promise.all([sender.open(), listener.open()]);
    for (const instance of [sender, listener]) {
      await instance.page.getByRole('button', { name: 'Voice channels', exact: true }).click();
      const room = instance.page.getByRole('article', { name: 'Team open room', exact: true });
      await room.getByRole('button', { name: 'Join voice', exact: true }).click();
      await expect(room.getByRole('button', { name: 'Leave voice', exact: true })).toBeVisible();
    }
    const room = sender.page.getByRole('article', { name: 'Team open room', exact: true });
    await room.getByRole('button', { name: 'Enable microphone', exact: true }).click();
    await expect.poll(received, { timeout: 20000 }).toBeGreaterThan(0);
    const before = await received();
    await listener.page.getByRole('button', { name: 'Close Voice channels', exact: true }).click();
    await expect.poll(received, { timeout: 10000 }).toBeGreaterThan(before + 10);
    await listener.page.getByRole('button', { name: 'Voice channels', exact: true }).click();
    await expect(listener.page.getByRole('article', { name: 'Team open room', exact: true }).getByRole('button', { name: 'Leave voice', exact: true })).toBeVisible();
    await room.getByRole('button', { name: 'Mute microphone', exact: true }).click();
    await expect(room.getByRole('button', { name: 'Enable microphone', exact: true })).toBeVisible();
    for (const instance of [sender, listener]) {
      const channel = instance.page.getByRole('article', { name: 'Team open room', exact: true });
      await channel.getByRole('button', { name: 'Leave voice', exact: true }).click();
      await expect(channel.getByRole('button', { name: 'Join voice', exact: true })).toBeEnabled();
    }
  } finally { await Promise.all([sender.context.close(), listener.context.close()]); }
});
