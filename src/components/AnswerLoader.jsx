import {createResource, createSignal} from "solid-js";
import {Show} from 'solid-js/web';
import {debounce} from '@solid-primitives/scheduled';
import {onAuth} from './LoginModal.jsx';
import appState, {reloadStats} from './appState.jsx';
import ajax from './ajax.jsx';

export default function AnswerLoader({type = 'radio', name, value, children}) {
    type = (
        type === 'check' ?
            'checkbox' :
        type === 'dot' ?
            'radio' :
            type
    );

    const id = 'answer-' + Math.round(Math.random() * 10000);
    const [page, setPage] = createSignal(0);
    const [query, setQuery] = createSignal('');
    const [data] = createResource(() => [page(), query()], ([p, q]) => getAnswers(p, q, name, value));

    const [stat] = createResource(
        () => [appState.bankId, appState.reloadStatsSignal],
        () => getVoteStats(name, value),
        {
            initialValue: {
                count: 0,
                percent: '0%',
                winner: false,
                checked: false,
            }
        }
    );

    const onQuery = debounce((v) => {
        setPage(1);
        setQuery(v);
    }, 300);

    const onInputChange = (e) => {
        const input = e.target;
        const {checked} = e.target;

        onAuth(async (success) => {
            if (success) {
                postAnswer({name, value, checked}).then(reloadStats, reloadStats);
            }
            else {
                input.checked = !checked;
            }
        });
    };

    return (
        <div class="mt-5 answer">
            <div class="form-check rounded bg-primary">
                <input
                    class="form-check-input"
                    type={type}
                    name={name}
                    value={value}
                    checked={stat().checked}
                    id={id}
                    onChange={onInputChange}
                />

                <label class="form-check-label" htmlFor={id}>
                    {children}
                </label>
            </div>

            <div class="d-lg-flex align-items-center">
                <div class="progress flex-fill" style="height: 25px">
                    <div
                        classList={{
                            "progress-bar overflow-visible": true,
                            "bg-success": stat().winner,
                        }}
                        style={{width: stat().percent, "min-width": '40px'}}
                    >
                        {stat().percent + ' (' + stat().count + ')'}
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

            <Show when={page() > 0 && !!data()}>
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

let statsVotes = [];
let statsPromise = null;

/**
 * @param {string} vote
 * @param {string} [value]
 * @return {Promise<{count: number, percent: string, winner: boolean, checked: boolean}>}
 */
export async function getVoteStats(vote, value) {
    if (!statsVotes.includes(vote)) {
        statsVotes.push(vote);
    }

    if (!statsPromise) {
        statsPromise = new Promise((done, fail) => {
            setTimeout(() => {
                ajax('/votes-stats', {
                    votes: statsVotes,
                    bank_id: appState.bankId,
                })
                .then(done, fail);

                statsVotes = [];
                statsPromise = null;
            }, 150);
        });
    }

    const stats = await statsPromise;

    if (!value) return stats[vote];

    const data = stats[vote][value] || {
        count: 0,
        percent: 0,
        winner: false,
        checked: false,
    };

    data.percent += '%';

    return data;
}

/**
 * @param {number} page
 * @param {string} query
 * @param {string} vote
 * @param {string} value
 * @return {Promise<{pages: number, rows: Array<{number: number, name: string}>}>}
 */
async function getAnswers(page, query, vote, value) {
    if (!page) return {rows: [], pages: 0};

    return ajax('/answers', {
        page,
        searchName: query,
        vote,
        value
    });
}

function postAnswer({name, value, checked}) {
    return ajax('/answer', {
        bank_id: appState.bankId,
        name: appState.name,
        vote: name,
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