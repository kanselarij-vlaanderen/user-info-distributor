import { app, errorHandler } from 'mu';
import bodyParser from 'body-parser';

import * as delta from './lib/delta';
import * as queries from './queries';

import { USER_INFO_GRAPH, WATCH_TYPES, UPDATEABLE_PREDICATES } from './config';

app.post('/delta', bodyParser.json(), async (req, res) => {
  res.status(202).end();
  const insertionDeltas = delta.insertionDeltas(req.body);
  const deletionDeltas = delta.deletionDeltas(req.body);
  console.debug(`Received deltas (${insertionDeltas.length + deletionDeltas.length} total)`);

  // INSERTIONS (new user info)
  const typeInsertionDeltas = delta.filterTypeDeltas(insertionDeltas, WATCH_TYPES);
  if (typeInsertionDeltas.length) {
    console.log(`Received deltas for ${typeInsertionDeltas.length} INSERTED user info object(s)`);
  }
  for (const d of typeInsertionDeltas) {
    const subject = d.subject.value;
    const type = d.object.value;
    console.log(`Inserting user info for <${subject}> (<${type}>) in destination graph ...`);
    await queries.updateInDestinationGraph(subject, type, USER_INFO_GRAPH);
  }

  // DELETIONS (removed user info)
  const typeDeletionDeltas = delta.filterTypeDeltas(deletionDeltas, WATCH_TYPES);
  if (typeDeletionDeltas.length) {
    console.log(`Received deltas for ${typeDeletionDeltas.length} DELETED user info object(s)`);
  }
  for (const d of typeDeletionDeltas) {
    const subject = d.subject.value;
    const type = d.object.value;
    console.log(`Removing user info for <${subject}> (<${type}>) from destination graph ...`);
    await queries.updateInDestinationGraph(subject, type, USER_INFO_GRAPH);
  }

  // UPDATES (modified user info)
  /*
   * NOTE: To avoid triggering queries for resource type on each received delta, we filter deltas
   * based on user-info related predicates in which we expect modifications. Note however that
   * updates to properties not included here, will not be picked up for user info distribution
   */
  const updateDeltas = delta.filterPredicateDeltas([...insertionDeltas, ...deletionDeltas], UPDATEABLE_PREDICATES);
  let updates = delta.uniqueDeltaSubjects(updateDeltas);
  const inserts = delta.uniqueDeltaSubjects(typeInsertionDeltas);
  const deletes = delta.uniqueDeltaSubjects(typeDeletionDeltas);
  updates = updates.filter(e => !inserts.includes(e)).filter(e => !deletes.includes(e));
  if (updates.length) {
    console.log(`Received deltas for ${updates.length} potentially UPDATED user info object(s)`);
  }
  for (const s of updates) {
    const type = await queries.subjectIsTypeInGraph(s, USER_INFO_GRAPH, WATCH_TYPES.map(t => t.type));
    if (type) {
      console.log(`Updating user info for <${s}> (<${type}>) in destination graph ...`);
      await queries.updateInDestinationGraph(s, type, USER_INFO_GRAPH);
    }
  }
});

/*
 * Redistribute user info from the user info graph to the destination graphs based on the users' groups
 * NOTE: Assumes the destination graphs to be empty (or not contain any user-info yet)
 */
app.post('/redistribute', async (req, res) => {
  console.log('Starting redistribution of user info');
  res.status(202).end();
  for (const type of WATCH_TYPES.map(t => t.type)) {
    console.log(`Redistributing resources of type <${type}> ...`);
    await queries.redistribute(type, USER_INFO_GRAPH);
  }
  console.log('Finished redistribution of user info');
});

app.use(errorHandler);
