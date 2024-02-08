import {createResource, createSignal, onMount} from "solid-js";
import {isServer, Show} from 'solid-js/web';
import {debounce} from '@solid-primitives/scheduled';
import {onConfirmAndAuth} from './LoginModal.jsx';
import {addNotification} from './Notifications.jsx';
import appState, {reloadStats} from '@lib/appState.js';
import ajax from '@lib/ajax.js';

export default function AnswerLoader({name, value, children}) {
    const id = 'answer-' + Math.round(Math.random() * 10000);
    const [page, setPage] = createSignal(0);
    const [query, setQuery] = createSignal('');
    const [data] = createResource(
        () => [page(), query(), appState.reloadStatsSignal],
        ([p, q]) => getAnswers(p, q, name, value),
        {
            initialValue: {
                pages: 0,
                rows: [],
            }
        }
    );

    const [stat] = createResource(
        () => [appState.jwt, appState.reloadStatsSignal],
        () => getPollStats(name, value),
        {
            initialValue: {
                count: 0,
                percent: 0,
                winner: false,
                checked: false,
                disabled: false,
            }
        }
    );

    const onQuery = debounce((v) => {
        setPage(1);
        setQuery(v);
    }, 300);

    let input;

    const onChangeAnswer = () => {
        const {checked} = input;
        const params = {poll: name, value, checked: checked ? 1 : ''};

        onConfirmAndAuth(
            children.cloneNode(true),
            checked,
            params,
            (success) => {
                if (!success) {
                    input.checked = !checked;
                    reloadStats();
                    return;
                }

                postAnswer({name, value, checked})
                .then(function (res) {
                    reloadStats();

                    if (res?.is_new) {
                        addNotification({
                            type: 'success',
                            text: 'Ви можете змінити свою відповідь на протязі 10 хвилин',
                        });
                    }
                })
                .catch(reloadStats);
            }
        );
    };

    onMount(() => {
       if (isServer) return;

       const url = new URL(location.href);
       const qs = url.searchParams;

       if (
           qs.has('jwt') &&
           (qs.get('poll') === name || url.pathname === '/polls/' + name) &&
           qs.get('value') === value &&
           qs.has('checked')
       ) {
           input.checked = !!Number(qs.get('checked'));
           onChangeAnswer();
       }
    });

    return (
        <div class="mt-5 answer">
            <div
                class="form-check rounded bg-primary"
                title={stat().disabled ? `Ви більше не можете змінити вашу відповідь` : ``}
            >
                <input
                    ref={input}
                    class="form-check-input"
                    type="checkbox"
                    name={name}
                    value={value}
                    checked={stat().checked}
                    disabled={stat().disabled}
                    id={id}
                    onChange={onChangeAnswer}
                />

                <label class="form-check-label" htmlFor={id}>
                    {children}
                </label>
            </div>

            <div class="d-lg-flex align-items-center" style="min-height: 32px">
                <div class="progress flex-fill" style="height: 25px">
                    <div
                        classList={{
                            "progress-bar overflow-visible": true,
                            "bg-success": stat().winner,
                        }}
                        style={{width: stat().percent + '%', "min-width": '40px'}}
                    >
                        {stat().percent + '% (' + stat().count + ')'}
                    </div>
                </div>

                <Show when={stat().count > 0}>
                    <button
                        type="button"
                        class="btn btn-light btn-sm ms-lg-3 mt-2 mt-lg-0"
                        onClick={() => setPage(p => p > 0 ? 0 : 1)}
                    >
                        {page() === 0 ?
                            <span>Показати список громадян</span> :
                            <span>Сховати список громадян</span>
                        }
                    </button>
                </Show>
            </div>

            <Show when={page() > 0 && stat().count > 0}>
                <table class="table table-sm my-5">
                    <thead>
                    <tr>
                        <th>&nbsp;</th>
                        <th width="95%">
                            <div class="d-flex align-items-center">
                                <span class="flex-fill">Імʼя</span>

                                <div class="col-lg-6">
                                    <div class="input-group input-group-sm">
                                        <input
                                            type="text"
                                            placeholder="Пошук по імені"
                                            class="form-control"
                                            value={query()}
                                            onInput={e => {
                                                onQuery(e.target.value);
                                            }}
                                        />

                                        <Show when={!!query()}>
                                            <button
                                                class="btn btn-outline-secondary"
                                                type="button"
                                                onClick={() => {
                                                    setPage(1);
                                                    setQuery('');
                                                }}
                                            >
                                                X
                                            </button>
                                        </Show>
                                    </div>
                                </div>
                            </div>
                        </th>
                    </tr>
                    </thead>

                    <tbody>
                    {data().rows.map(({number, name}) => (
                        <tr>
                            <td>{number}</td>
                            <td>{name}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>

                <Show when={data().pages > 1}>
                    <nav>
                        <ul class="pagination">
                            {range(data().pages).map((n) => (
                                <li
                                    classList={{
                                        ["page-item"]: true,
                                        disabled: n === page(),
                                    }}
                                >
                                    <a
                                        class="page-link"
                                        href={'#' + n}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setPage(n);
                                        }}
                                    >{n}</a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </Show>
            </Show>
        </div>
    );
}

let statsPolls = [];
let statsPromise = null;

/**
 * @param {string} poll
 * @param {string} [value]
 * @return {Promise<{count: number, percent: number, winner: boolean, checked: boolean, disabled: boolean}>}
 */
export async function getPollStats(poll, value) {
    if (!statsPolls.includes(poll)) {
        statsPolls.push(poll);
    }

    if (!statsPromise) {
        statsPromise = new Promise((done, fail) => {
            setTimeout(() => {
                ajax('/polls-stats', {
                    polls: statsPolls,
                    jwt: appState.jwt,
                })
                .then(done, fail);

                statsPolls = [];
                statsPromise = null;
            }, 150);
        });
    }

    const data = await statsPromise;
    const {stats, disabled} = data;

    if (!stats.hasOwnProperty(poll)) {
        stats[poll] = {};
    }

    if (!value) return stats[poll];

    const info = stats[poll][value] || {
        count: 0,
        percent: 0,
        winner: false,
        checked: false,
    };

    info.disabled = disabled.includes(poll);

    return info;
}

/**
 * @param {number} page
 * @param {string} query
 * @param {string} poll
 * @param {string} value
 * @return {Promise<{pages: number, rows: Array<{number: number, name: string}>}>}
 */
async function getAnswers(page, query, poll, value) {
    if (!page || isServer) return {rows: [], pages: 0};

    return ajax('/answers', {
        page,
        searchName: query,
        poll,
        value,
    });
}

function postAnswer({name, value, checked}) {
    return ajax('/answer', {
        jwt: appState.jwt,
        poll: name,
        value,
        checked,
    });
}

function range(n) {
    const pages = [];

    for (let i = 1; i <= n; i++) {
        pages.push(i);
    }

    return pages;
}