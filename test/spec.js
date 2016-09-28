'use strict';
const expect = require('chai').expect;
const sinon = require('sinon');

module.exports = (fetchMock, theGlobal, Request, Response) => {

	describe('fetch-mock', () => {

		let fetchCalls = [];
		const dummyRoute = {
			matcher: /a/,
			response: 200
		};

		const dummyFetch = () => {
			fetchCalls.push([].slice.call(arguments));
			return Promise.resolve(arguments);
		};

		before(() => {
			theGlobal.fetch = fetchMock.realFetch = dummyFetch;
		})

		afterEach(() => {
			fetchCalls = [];
		});

		describe('Interface', () => {

			it('restores fetch', () => {
				fetchMock.mock(dummyRoute);
				fetchMock.restore();
				expect(fetch).to.equal(dummyFetch);
			});

			it('allow multiple mocking calls', () => {
				fetchMock.mock('^http://route1', 200);
				expect(() => {
					fetchMock.mock('^http://route2', 200);
				}).not.to.throw();
				fetch('http://route1.com')
				fetch('http://route2.com')
				expect(fetchMock.calls().matched.length).to.equal(2);
				fetchMock.restore();
			});

			it('mocking is chainable', () => {
				expect(() => {
					fetchMock
						.mock('^http://route1', 200)
						.mock('^http://route2', 200);
				}).not.to.throw();
				fetch('http://route1.com')
				fetch('http://route2.com')
				expect(fetchMock.calls().matched.length).to.equal(2);
				fetchMock.restore();
			});

			it('binds mock to self', () => {
				sinon.spy(fetchMock, 'mock');
				fetchMock.mock(dummyRoute);
				expect(fetchMock.mock.lastCall.thisValue).to.equal(fetchMock);
				fetchMock.mock.restore();
			});

			it('allow remocking after being restored', () => {
				fetchMock.mock(dummyRoute);
				fetchMock.restore();
				expect(() => {
					fetchMock.mock(dummyRoute);
					fetchMock.restore();
				}).not.to.throw();
			});

			it('restore is chainable', () => {
				fetchMock.mock(dummyRoute);
				expect(() => {
					fetchMock.restore().mock(dummyRoute);
				}).not.to.throw();
			});

			it('binds restore to self', () => {
				sinon.spy(fetchMock, 'restore');
				fetchMock.restore();
				expect(fetchMock.restore.lastCall.thisValue).to.equal(fetchMock);
				fetchMock.restore.restore();
			});

			it('restore can be called even if no mocks set', () => {
				expect(() => {
					fetchMock.restore();
				}).not.to.throw();
			});

			it('reset is chainable', () => {
				fetchMock.mock(dummyRoute);
				expect(() => {
					fetchMock.reset().mock(dummyRoute);
				}).not.to.throw();
			});

			it('binds reset to self', () => {
				sinon.spy(fetchMock, 'reset');
				fetchMock.reset();
				expect(fetchMock.reset.lastCall.thisValue).to.equal(fetchMock);
				fetchMock.reset.restore();
			});

		});

		describe('catch()', () => {
			beforeEach(() => {
				fetchMock.restore();
			});

			it('can catch all calls to fetch with good response by default', () => {
				fetchMock.catch();
				return fetch('http://place.com/')
					.then(res => {
						expect(res.status).to.equal(200);
						expect(fetchMock.calls().unmatched[0]).to.eql([ 'http://place.com/', undefined ])
					})
			})

			it('can catch all calls to fetch with custom response', () => {
				fetchMock.catch(Promise.resolve('carrot'));
				return fetch('http://place.com/')
					.then(res => {
						expect(res.status).to.equal(200);
						expect(fetchMock.calls().unmatched[0]).to.eql([ 'http://place.com/', undefined ])
						return res.text()
							.then(text => expect(text).to.equal('carrot'))
					})
			})

			it('can call catch after calls to mock', () => {
				fetchMock
					.mock('http://other-place.com', 404)
					.catch();
				return fetch('http://place.com/')
					.then(res => {
						expect(res.status).to.equal(200);
						expect(fetchMock.calls().unmatched[0]).to.eql([ 'http://place.com/', undefined ])
					})
			})

		})

		describe('mock()', () => {

			beforeEach(() => {
				fetchMock.restore();
			});

			describe('parameters', () => {
				beforeEach(() => {
					sinon.stub(fetchMock, 'addRoute');
				});

				afterEach(() => {
					fetchMock.addRoute.restore();
				});

				it('accepts single config object', () => {
					const config = {name: 'route', matcher: 'http://it.at.there/', response: 'ok'};
					expect(() => {
						fetchMock.mock(config);
					}).not.to.throw();
					expect(fetchMock.addRoute.calledWith(config));
				});

				it('accepts matcher, route pairs', () => {
					expect(() => {
						fetchMock.mock('http://it.at.there/', 'ok');
					}).not.to.throw();
					expect(fetchMock.addRoute.calledWith({matcher: 'http://it.at.there/', response: 'ok'}));
				});

				it('accepts matcher, response, config triples', () => {
					expect(() => {
						fetchMock.mock('http://it.at.there/', 'ok', {method: 'PUT', some: 'prop'});
					}).not.to.throw();
					expect(fetchMock.addRoute.calledWith({matcher: 'http://it.at.there/', response: 'ok', method: 'PUT', some: 'prop'}));
				});

				it('throws helpful error on matcher, method, route triples', () => {
					expect(() => {
						fetchMock.mock('http://it.at.there/', 'PUT', 'ok');
					}).to.throw(/API for method matching has changed/);
				});

				it('expects a matcher', () => {
					expect(() => {
						fetchMock.mock(null, 'ok');
					}).to.throw();
				});

				it('expects a response', () => {
					expect(() => {
						fetchMock.mock('http://it.at.there/');
					}).to.throw();
				});

				describe('method shorthands', () => {
					'get,post,put,delete,head'.split(',')
						.forEach(method => {
							it(`has shorthand for ${method.toUpperCase()}`, () => {
								sinon.stub(fetchMock, 'mock');
								fetchMock[method]('a', 'b');
								fetchMock[method]('a', 'b', {opt: 'c'});
								expect(fetchMock.mock.calledWith('a', 'b', {method: method.toUpperCase()})).to.be.true;
								expect(fetchMock.mock.calledWith('a', 'b', {opt: 'c', method: method.toUpperCase()})).to.be.true;
								fetchMock.mock.restore();
							});
						})
				});

			});


			describe('matching routes', () => {

				it('match exact strings', () => {
					fetchMock
						.mock({
							name: 'route',
							matcher: 'http://it.at.there/',
							response: 'ok'
						})
						.catch();
					return Promise.all([fetch('http://it.at.there/'), fetch('http://it.at.thereabouts')])
						.then(() => {
							expect(fetchMock.called()).to.be.true;
							expect(fetchMock.called('route')).to.be.true;
							expect(fetchMock.calls().matched.length).to.equal(1);
							expect(fetchMock.calls('route').length).to.equal(1);
							expect(fetchMock.calls().unmatched.length).to.equal(1);
						});
				});

				it('match when relative url', () => {
					fetchMock.mock({
						name: 'route',
						matcher: '/it.at.there/',
						method: 'POST',
						response: 'ok'
					})
					.catch();
					return fetch('/it.at.there/', {method: 'POST'})
						.then(() => {
							expect(fetchMock.called()).to.be.true;
							expect(fetchMock.called('route')).to.be.true;
							expect(fetchMock.calls().matched.length).to.equal(1);
							expect(fetchMock.calls('route').length).to.equal(1);
						});
				});

				it('match when Request instance', () => {
					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						method: 'POST',
						response: 'ok'
					}).catch();
					return fetch(new Request('http://it.at.there/', {method: 'POST'}))
						.then(() => {
							expect(fetchMock.called()).to.be.true;
							expect(fetchMock.called('route')).to.be.true;
							expect(fetchMock.calls().matched.length).to.equal(1);
							expect(fetchMock.calls('route').length).to.equal(1);
						});
				});

				it('match strings starting with a string', () => {
					fetchMock.mock({
						name: 'route',
						matcher: '^http://it.at.there',
						response: 'ok'
					}).catch();
					return Promise.all([
						fetch('http://it.at.there'),
						fetch('http://it.at.thereabouts'),
						fetch('http://it.at.hereabouts')]
					)
						.then(() => {
							expect(fetchMock.called()).to.be.true;
							expect(fetchMock.called('route')).to.be.true;
							expect(fetchMock.calls().matched.length).to.equal(2);
							expect(fetchMock.calls('route').length).to.equal(2);
							expect(fetchMock.calls().unmatched.length).to.equal(1);
						});
				});

				it('match wildcard string', () => {
					fetchMock.mock({
						name: 'route',
						matcher: '*',
						response: 'ok'
					}).catch();
					return Promise.all([
						fetch('http://it.at.there'),
						fetch('http://it.at.thereabouts'),
						fetch('http://it.at.hereabouts')]
					)
						.then(() => {
							expect(fetchMock.called()).to.be.true;
							expect(fetchMock.called('route')).to.be.true;
							expect(fetchMock.calls().matched.length).to.equal(3);
							expect(fetchMock.calls('route').length).to.equal(3);
						});
				});

				it('match regular expressions', () => {
					fetchMock.mock({
						name: 'route',
						matcher: /http\:\/\/it\.at\.there\/\d+/,
						response: 'ok'
					}).catch();
					return Promise.all([fetch('http://it.at.there/'), fetch('http://it.at.there/12345'), fetch('http://it.at.there/abcde')])
						.then(() => {
							expect(fetchMock.called()).to.be.true;
							expect(fetchMock.called('route')).to.be.true;
							expect(fetchMock.calls('route').length).to.equal(1);
							expect(fetchMock.calls().matched.length).to.equal(1);
							expect(fetchMock.calls().unmatched.length).to.equal(2);
						});
				});

				it('match using custom functions', () => {
					fetchMock.mock({
						name: 'route',
						matcher: (url, opts) => {
							return url.indexOf('logged-in') > -1 && opts && opts.headers && opts.headers.authorized === true;
						},
						response: 'ok'
					}).catch();
					return Promise.all([
						fetch('http://it.at.there/logged-in', {headers:{authorized: true}}),
						fetch('http://it.at.there/12345', {headers:{authorized: true}}),
						fetch('http://it.at.there/logged-in')
					])
						.then(() => {
							expect(fetchMock.called()).to.be.true;
							expect(fetchMock.called('route')).to.be.true;
							expect(fetchMock.calls('route').length).to.equal(1);
							expect(fetchMock.calls().matched.length).to.equal(1);
							expect(fetchMock.calls().unmatched.length).to.equal(2);
						});
				});

        it('match method', () => {
					fetchMock.mock({
							name: 'route1',
							method: 'get',
							matcher: 'http://it.at.here/',
							response: 'ok'
						}).mock({
							name: 'route2',
							method: 'put',
							matcher: 'http://it.at.here/',
							response: 'ok'
						}).catch();
					return Promise.all([
						fetch('http://it.at.here/', {method: 'put'}),
						fetch('http://it.at.here/'),
						fetch('http://it.at.here/', {method: 'GET'}),
						fetch('http://it.at.here/', {method: 'delete'})
					])
						.then(() => {
							expect(fetchMock.called()).to.be.true;
							expect(fetchMock.called('route1')).to.be.true;
							expect(fetchMock.called('route2')).to.be.true;
							expect(fetchMock.calls('route1').length).to.equal(2);
							expect(fetchMock.calls('route2').length).to.equal(1);
							expect(fetchMock.calls().matched.length).to.equal(3);
							expect(fetchMock.calls().unmatched.length).to.equal(1);
						});
        });


				it('match headers', () => {
					fetchMock.mock({
							name: 'route1',
							headers: {
								test: 'yes'
							},
							matcher: 'http://it.at.here/',
							response: 'ok'
						}).mock({
							name: 'route2',
							headers: {
								test: 'else',
								again: 'oh yes'
							},
							matcher: 'http://it.at.here/',
							response: 'ok'
						}).catch();
					return Promise.all([
						fetch('http://it.at.here/', {headers: {test: 'yes'}}),
						fetch('http://it.at.here/', {headers: {test: 'else'}}),
						fetch('http://it.at.here/', {headers: {test: 'else', AGAIN: 'oh yes'}}),
						fetch('http://it.at.here/')
					])
						.then(() => {
							expect(fetchMock.called()).to.be.true;
							expect(fetchMock.called('route1')).to.be.true;
							expect(fetchMock.called('route2')).to.be.true;
							expect(fetchMock.calls('route1').length).to.equal(1);
							expect(fetchMock.calls('route2').length).to.equal(1);
							expect(fetchMock.calls().matched.length).to.equal(2);
							expect(fetchMock.calls().unmatched.length).to.equal(2);
						});
        });

				it('match multiple routes', () => {
					fetchMock.mock({
							name: 'route1',
							matcher: 'http://it.at.there/',
							response: 'ok'
						}).mock({
							name: 'route2',
							matcher: 'http://it.at.here/',
							response: 'ok'
						}).catch();
					return Promise.all([fetch('http://it.at.there/'), fetch('http://it.at.here/'), fetch('http://it.at.nowhere')])
						.then(() => {
							expect(fetchMock.called()).to.be.true;
							expect(fetchMock.called('route1')).to.be.true;
							expect(fetchMock.called('route2')).to.be.true;
							expect(fetchMock.calls('route1').length).to.equal(1);
							expect(fetchMock.calls('route2').length).to.equal(1);
							expect(fetchMock.calls().matched.length).to.equal(2);
							expect(fetchMock.calls().unmatched.length).to.equal(1);
						});
				});

				it('match first compatible route when many routes match', () => {
					fetchMock.mock({
							name: 'route1',
							matcher: 'http://it.at.there/',
							response: 'ok'
						}).mock({
							name: 'route2',
							matcher: '^http://it.at.there/',
							response: 'ok'
						}).catch();
					return Promise.all([fetch('http://it.at.there/')])
						.then(() => {
							expect(fetchMock.called()).to.be.true;
							expect(fetchMock.called('route1')).to.be.true;
							expect(fetchMock.calls('route1').length).to.equal(1);
							expect(fetchMock.calls().matched.length).to.equal(1);
							expect(fetchMock.calls('route2').length).to.equal(0);
						});
				});

				it('falls back to matcher.toString() as a name', () => {
					expect(() => {
						fetchMock.mock({matcher: 'http://it.at.there/', response: 'ok'});
					}).not.to.throw();
					fetch('http://it.at.there/');
					expect(fetchMock.calls('http://it.at.there/').length).to.equal(1);
				});


				it('record history of calls to matched routes', () => {
					fetchMock.mock({
						name: 'route',
						matcher: '^http://it.at.there',
						response: 'ok'
					}).catch();
					return Promise.all([fetch('http://it.at.there/'), fetch('http://it.at.thereabouts', {headers: {head: 'val'}})])
						.then(() => {
							expect(fetchMock.called()).to.be.true;
							expect(fetchMock.called('route')).to.be.true;
							expect(fetchMock.calls().matched.length).to.equal(2);
							expect(fetchMock.calls('route')[0]).to.eql(['http://it.at.there/', undefined]);
							expect(fetchMock.calls('route')[1]).to.eql(['http://it.at.thereabouts', {headers: {head: 'val'}}]);
						});
				});

				it('have helpers to retrieve paramaters pf last call', () => {
					fetchMock.mock({
						name: 'route',
						matcher: '^http://it.at.there',
						response: 200
					});
					// fail gracefully
					expect(() => {
						fetchMock.lastCall();
						fetchMock.lastUrl();
						fetchMock.lastOptions();
					}).to.not.throw;
					return Promise.all([
						fetch('http://it.at.there/first', {method: 'DELETE'}),
						fetch('http://it.at.there/second', {method: 'GET'})
					])
						.then(() => {
							expect(fetchMock.lastCall('route')).to.deep.equal(['http://it.at.there/second', {method: 'GET'}]);
							expect(fetchMock.lastCall()).to.deep.equal(['http://it.at.there/second', {method: 'GET'}]);
							expect(fetchMock.lastUrl()).to.equal('http://it.at.there/second');
							expect(fetchMock.lastOptions()).to.deep.equal({method: 'GET'});
						});

				})

				it('be possible to reset call history', () => {
					fetchMock.mock({
						name: 'route',
						matcher: '^http://it.at.there/',
						response: 'ok'
					});
					return fetch('http://it.at.there/')
						.then(() => {
							fetchMock.reset();
							expect(fetchMock.called()).to.be.false;
							expect(fetchMock.called('route')).to.be.false;
							expect(fetchMock.calls('route').length).to.equal(0);
							expect(fetchMock.calls().matched.length).to.equal(0);
						});
				});

				it('restoring clears call history', () => {
					fetchMock.mock({
						name: 'route',
						matcher: '^http://it.at.there/',
						response: 'ok'
					});
					return fetch('http://it.at.there/')
						.then(() => {
							fetchMock.restore();
							expect(fetchMock.called()).to.be.false;
							expect(fetchMock.called('route')).to.be.false;
							expect(fetchMock.calls('route').length).to.equal(0);
							expect(fetchMock.calls().matched.length).to.equal(0);
						});
				});
			});

			describe('unmatched routes', () => {

				it('throws if any calls unmatched', () => {
					fetchMock.mock(dummyRoute);
					expect(() => {
						fetch('http://1');
					}).to.throw;
				});

				it('can catch unmatched calls with empty 200', () => {
					fetchMock
						.catch()
						.mock(dummyRoute);
					return fetch('http://1')
						.then(res => {
							expect(fetchMock.called()).to.be.false;
							expect(fetchMock.calls().unmatched.length).to.equal(1);
							expect(res.status).to.equal(200);
						});
				});

				it('can catch unmatched calls with custom response', () => {
					fetchMock
						.catch({iam: 'json'})
						.mock(dummyRoute);
					return fetch('http://1')
						.then(res => {
							expect(fetchMock.called()).to.be.false;
							expect(fetchMock.calls().unmatched.length).to.equal(1);
							expect(res.status).to.equal(200);
							return res.json().then(json => {
								expect(json).to.eql({iam: 'json'});
							});
						});
				});

				it('can catch unmatched calls with function', () => {
					fetchMock
						.catch(() => new Response('i am text', {status: 200	}))
						.mock(dummyRoute);
					return fetch('http://1')
						.then(res => {
							expect(fetchMock.called()).to.be.false;
							expect(fetchMock.calls().unmatched.length).to.equal(1);
							expect(res.status).to.equal(200);
							return res.text().then(text => {
								expect(text).to.equal('i am text');
							});
						});
				});


				it('record history of unmatched routes', () => {
					fetchMock
						.catch()
						.mock(dummyRoute);
					return Promise.all([
						fetch('http://1', {method: 'GET'}),
						fetch('http://2', {method: 'POST'})
					])
						.then(() => {
							expect(fetchMock.called()).to.be.false;
							const unmatchedCalls = fetchMock.calls().unmatched;
							expect(unmatchedCalls.length).to.equal(2);
							expect(unmatchedCalls[0]).to.eql(['http://1', {method: 'GET'}]);
							expect(unmatchedCalls[1]).to.eql(['http://2', {method: 'POST'}]);
						})

				});

			});


			describe('responding', () => {

				it('respond with a Response', () => {
					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						response: new Response('i am text', {status: 200})
					});
					return fetch('http://it.at.there/')
						.then(res => {
							expect(res.status).to.equal(200);
							return res.text()
								.then(text => {
									expect(text).to.equal('i am text');
								})
						});
				});

				it('respond with a generated Response', () => {
					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						response: () => new Response('i am text too', {status: 200})
					});
					return fetch('http://it.at.there/')
						.then(res => {
							expect(res.status).to.equal(200);
							return res.text()
								.then(text => {
									expect(text).to.equal('i am text too');
								})
						});
				});

				it('respond with a status', () => {
					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						response: 300
					});
					return fetch('http://it.at.there/')
						.then(res => {
							expect(res.status).to.equal(300);
							expect(res.statusText).to.equal('Multiple Choices');
						});
				});

				it('respond with a string', () => {
					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						response: 'a string'
					});
					return fetch('http://it.at.there/')
						.then(res => {
							expect(res.status).to.equal(200);
							expect(res.statusText).to.equal('OK');
							return res.text()
						})
						.then(text => {
							expect(text).to.equal('a string');
						});
				});

				it('respond with a json', () => {
					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						response: {an: 'object'}
					});
					return fetch('http://it.at.there/')
						.then(res => {
							expect(res.status).to.equal(200);
							expect(res.statusText).to.equal('OK');
							return res.json();
						})
						.then(json => {
							expect(json).to.eql({an: 'object'});
						});
				});

				it('respond with a status', () => {
					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						response: {status: 404}
					});
					return fetch('http://it.at.there/')
						.then(res => {
							expect(res.status).to.equal(404);
							expect(res.statusText).to.equal('Not Found');
						});
				});

				it('respond with a complex response, including headers', () => {
					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						response: {
							status: 202,
							body: {an: 'object'},
							headers: {
								header: 'val'
							}
						}
					});
					return fetch('http://it.at.there/')
						.then(res => {
							expect(res.status).to.equal(202);
							expect(res.headers.get('header')).to.equal('val');
							res.json().then(json => {
								expect(json).to.eql({an: 'object'});
							});
						});
				});

				it('imitate a failed request', () => {
					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						response: {
							throws: 'Oh no'
						}
					});
					return fetch('http://it.at.there/')
						.then(() => {
							return Promise.reject('Expected fetch to fail');
						}, err => {
							expect(err).to.equal('Oh no');
						});
				});

				it('construct a response based on the request', () => {
					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						response: (url, opts) => {
							return url + opts.headers.header;
						}
					});
					return fetch('http://it.at.there/', {headers: {header: 'val'}})
						.then(res => {
							expect(res.status).to.equal(200);
							return res.text().then(text => {
								expect(text).to.equal('http://it.at.there/val');
							});
						});
				});

				it('construct a promised response based on the request', () => {
					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						response: (url, opts) => {
							return Promise.resolve(url + opts.headers.header);
						}
					});
					return fetch('http://it.at.there/', {headers: {header: 'val'}})
						.then(res => {
							expect(res.status).to.equal(200);
							return res.text().then(text => {
								expect(text).to.equal('http://it.at.there/val');
							});
						});
				});

				it('respond with a promise of a response', done => {
					let resolve;
					const promise = new Promise(res => { resolve = res})
					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						response: promise.then(() => 200)
					});
					const stub = sinon.spy(res => res);

					fetch('http://it.at.there/', {headers: {header: 'val'}})
						.then(stub)
						.then(res => {
							expect(res.status).to.equal(200);
						});

					setTimeout(() => {
						expect(stub.called).to.be.false;
						resolve();
						setTimeout(() => {
							expect(stub.called).to.be.true;
							done();
						}, 10)
					}, 10)
				});

				it ('respond with a promise of a complex response', done => {
					let resolve;

					const promise = new Promise(res => {resolve = res})

					fetchMock.mock({
						name: 'route',
						matcher: 'http://it.at.there/',
						response: promise.then(() => (url, opts) => {
							return url + opts.headers.header;
						})
					});
					const stub = sinon.spy(res => res);

					fetch('http://it.at.there/', {headers: {header: 'val'}})
						.then(stub)
						.then(res => {
							expect(res.status).to.equal(200);
							return res.text().then(text => {
								expect(text).to.equal('http://it.at.there/val');
							});
						});
					setTimeout(() => {
						expect(stub.called).to.be.false;
						resolve();
						setTimeout(() => {
							expect(stub.called).to.be.true;
							done();
						}, 10)
					}, 10)
				});
			});

		});

		describe('configurability', () => {
			it('can configure sendAsJson off', () => {
				sinon.spy(JSON, 'stringify');
				fetchMock.configure({
					sendAsJson: false
				});
				fetchMock.mock('http://it.at.there/', {not: 'an object'});
				try {
					// it should throw as we're trying to respond with unstringified junk
					// ideally we'd use a buffer in the test, but the browser and node APIs differ
					fetch('http://it.at.there/')
					expect(false).to.be.true;
				} catch (e) {
					expect(JSON.stringify.calledWith({not: 'an object'})).to.be.false;
					JSON.stringify.restore();
					fetchMock.configure({
						sendAsJson: true
					});
				}
			});
		})

		describe('regressions', () => {
			it('should accept object respones when passing options', () => {
				expect(() => {
					fetchMock.mock('http://foo.com', { foo: 'bar' }, { method: 'GET' })
				}).to.not.throw();
				fetchMock.restore();
			})

			it('should expect valid statuses', () => {
				fetchMock.mock('http://foo.com', { status: 'not number' })
				expect(() => fetch('http://foo.com'))
					.to.throw(`Invalid status not number passed on response object.
To respond with a JSON object that has status as a property assign the object to body
e.g. {"body": {"status: "registered"}}`);
				fetchMock.restore();
			})

			it('should restore successfully after multiple mocks', () => {
				const realFetch = theGlobal.fetch;
				fetchMock
					.mock('http://foo.com', { status: 'not number' })
					.mock('http://foo2.com', { status: 'not number' })
				fetchMock.restore();
				expect(realFetch).to.equal(theGlobal.fetch);
			})

			it('should allow non native Promises as responses', () => {
				const stub = sinon.spy(() => Promise.resolve(new Response('', {status: 203})));
				fetchMock.mock(/.*/, {
				   then: stub
				})
				return fetch('http://thing.place')
					.then(res => {
						expect(stub.calledOnce).to.be.true
						expect(res.status).to.equal(203);
						fetchMock.restore();
					})
			})

		})
	});
}
