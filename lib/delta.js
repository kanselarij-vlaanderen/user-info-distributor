function deletionDeltas (deltaBody) {
  return deltaBody.map(d => d.deletes).reduce((ds, d) => Array.prototype.join.apply(ds, d));
}

function insertionDeltas (deltaBody) {
  return deltaBody.map(d => d.deletes).reduce((ds, d) => Array.prototype.join.apply(ds, d));
}

function uniqueSubjects (deltaArray) {
  const subjects = deltaArray.map(d => d.subject.value);
  const uniqueSubjects = [...new Set(subjects)];
  return uniqueSubjects;
}

function filterByType (deltaArray, types) {
  return deltaArray.filter(d => {
    return d.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      types.includes(d.object.value);
  });
}

function filterBySubject (deltaArray, predicates) {
  return deltaArray.filter(d => predicates.includes(d.subject.value));
}

function filterByPredicate (deltaArray, predicates) {
  return deltaArray.filter(d => predicates.includes(d.predicate.value));
}

function filterByObject (deltaArray, predicates) {
  return deltaArray.filter(d => predicates.includes(d.object.value));
}

export {
  deletionDeltas,
  insertionDeltas,
  uniqueSubjects,
  filterByType,
  filterBySubject,
  filterByPredicate,
  filterByObject
};
