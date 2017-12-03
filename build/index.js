'use strict';

module.exports = function dereference() {
  var methodsToHandle = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : ['find', 'findOne', 'findOneAndDelete', 'findOneAndUpdate'];

  return function (_ref) {
    var monkInstance = _ref.monkInstance;
    return function (next) {
      return function (args, method) {
        return next(args, method).then(function (res) {
          if (methodsToHandle.indexOf(method) === -1) {
            return res;
          }
          if (!(args.options || {}).refMapping) {
            return res;
          }
          if (!args.options.dereference) {
            return res;
          }

          var isArrayResult = Array.isArray(res);

          var queries = Object.keys(args.options.dereference).reduce(function (prev, ref) {
            if (!args.options.dereference[ref]) {
              return prev;
            }
            var collectionTarget = args.options.refMapping[ref].collection || args.options.refMapping[ref];
            if (!collectionTarget) {
              console.error('Missing mapping for ref ' + ref);
              return prev;
            }
            if (!isArrayResult && !res[ref]) {
              return prev;
            }
            var ids = isArrayResult ? res.reduce(function (_ids, o) {
              if (o[ref]) {
                _ids.push(o[ref]);
              }
              return _ids;
            }, []) : [res[ref]];
            if (ids.length) {
              prev.push({
                ref: ref,
                collectionTarget: collectionTarget,
                query: ids.length > 1 ? { $in: ids } : ids[0],
                fields: args.options.dereference[ref] === true ? undefined : args.options.dereference[ref]
              });
            }
            return prev;
          }, []);

          if (!queries.length) {
            return res;
          }

          return Promise.all(queries.map(function (o) {
            return monkInstance.get(o.collectionTarget).find({ _id: o.query }, o.fields);
          })).then(function (dereferences) {
            if (isArrayResult) {
              res.forEach(function (o) {
                dereferences.forEach(function (deref, i) {
                  var ref = queries[i].ref;

                  if (!o[ref]) {
                    return;
                  }
                  var value = deref.find(function (d) {
                    return monkInstance.id(d._id).toHexString() === monkInstance.id(o[ref]).toHexString();
                  }) || o[ref];

                  if (args.options.refMapping[ref].field) {
                    o[args.options.refMapping[ref].field] = value;
                  } else {
                    o[ref] = value;
                  }
                });
              });
            } else {
              dereferences.forEach(function (deref, i) {
                var ref = queries[i].ref;

                if (!res[ref]) {
                  return;
                }
                var value = deref.find(function (d) {
                  return monkInstance.id(d._id).toHexString() === monkInstance.id(res[ref]).toHexString();
                }) || res[ref];

                if (args.options.refMapping[ref].field) {
                  res[args.options.refMapping[ref].field] = value;
                } else {
                  res[ref] = value;
                }
              });
            }
            return res;
          });
        });
      };
    };
  };
};