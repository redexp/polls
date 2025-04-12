# Соціологічна служба Черкаського інституту міста

Цим проєктом Громадська організація «Черкаський інститут міста» започатковує новий підхід до проведення соціологічних досліджень, які з часом мають замінити старі методи вивчення громадської думки.

Завдяки цифровим інструментам соціологічні дослідження можуть стати:

- Більш масовими, а отже — якіснішими, з меншими статистичними похибками, краще відображати суспільну думку, бо тепер опитуваннями легше досягти радикально більшої аудиторії
- Дешевшими та швидшими, бо вже не потрібно утримувати великі команди інтерв’юерів, зустрічатися з опитуваними особисто і вручну аналізувати анкети
- Достовірнішими, бо застосування цифрового підпису та інших цифрових ідентифікаторів унеможливлює наданя неправдивих даних людьми, які погодилися взяти участь в опитуванні, та відсіює людей, які не є цільовою групою опитування за місцем проживання, дозволяє уникнути фальшування, дублювання опитувальників

## Основі можливості

- Декілька варіантів відповіді з можливістю обрати один чи декілька варіантів, або ввести свою відповідь з клавіатури.
- Ідентифікація через [BankID](https://bank.gov.ua/ua/bank-id-nbu) унеможливлює створення фальшивих відповідей.
- На питання зможуть відповідати лише громадяни зареєстровані у місті Черкаси.
- Окремі опитування можуть містити (за попереднім попередженням і згодою опитуваних) список імен тих, хто взяв участь в опитуванні, для того, щоб результати таких опитувань могли виконувати роль легальної, достовірної публічної демонстрації громадянської позиції на зразок петицій, які надалі можуть бути передані до органів місцевого самоврядування для відповідного реагування.

## Обмеження

- Голосувати зможуть лише громадяни зареєстровані у місті Черкаси.
- Відповіді змінювати можливо лише на протязі 10 хвилин.

## Технічні характеристики

- Відсутність будь-якої адмін панелі, що зменшує ризик зламу.
- Питання пишуться вручну у форматі [mdx](https://mdxjs.com), автоматично створюються статичні html файли за допомогою фреймворка [Astro](https://astro.build)
- Динамічна частина сайту виконується за допомогою [SolidJS](https://solidjs.com)
- Відповіді зберігаються на сервері у базі даних [SQLite](https://sqlite.org) разом з ім'ям, та ідентифікатором [BankID](https://bank.gov.ua/ua/bank-id-nbu) громадянина. 
- Окремо від імені (тобто анонімно) і повністю зашивровано, зберігається вік, стать та район міста (у форматі [Plus Code](https://uk.wikipedia.org/wiki/Відкритий_код_розташування) тобто не точна адреса, а приблизне місце розташування) того хто залишив відповідь для статистичних висновків.
- Запити від браузера обробляються сервером [Express](https://expressjs.com)
- Сервер не використовує cookie. Замість цього використовується технологія [JWT](https://jwt.io)

## Запуск проєкту у режимі розробки

1. Скопіюйте проєкт `git clone git@github.com:redexp/polls.git && cd polls`
2. Встановіть пакети `npm install`
3. Створіть актуальну базу даних `npm run migrate`. Буде створено файл `server/db/database.sqlite`.
4. Створіть ключі для шифрування статистичних даних `npm run keys`. Ключ `statistic_private_key.pem` треба перемістити у безпечне місце окремо від цього проєкту.
5. Сгенеруйте мета дані опитувань (це треба робити кожного разу коли ви редагуєте файли опитувань) `npm run meta`
6. Запустіть astro фреймворк `npm start`
7. Запустіть сервер API `npm run server`
8. Запустіть сервер який вдає BankID `npm run bankid`
9. Відкрийте сторінку http://localhost:4321

## Запуск проєкту у робочому режимі

1. Сгенеруйте статичні файли `npm run build`. Будуть створені файли у папці `dist`. Як правило їх копіюють в папку `public` на веб сервері і налаштовують `nginx` для того щоб він їх віддавав.
2. Скопіюйте папку `server` на ваш веб сервер і запустіть `node server/index.js`

## Редагування опитувань

Усі опитування мають бути у папці `src/polls` у форматі [mdx](https://mdxjs.com). 

Приклад опитування з дозволеним лише одним варіантом відповіді наведений у файлі `src/polls/only-one-answer.mdx`.
Приклад опитування з декількома дозволеними варіантами відповіді наведений у файлі `src/polls/many-answers.mdx`.

Для того щоб заборонити давати відповіді на опитування - перемістіть його файл у папку `src/polls/past` (створіть, якщо її нема).

Імʼя файла - це ідентифікатор опитування у базі даних, тож не змінюйте його у процесі збору відповідей.

Після редагування (тільки якщо ви змінили імʼя файлу чи кількість відповідей), треба виконати команду `npm run meta` і перезапустити сервер API `npm run server`.

## Розшифрування статистичних даних

Виконайте команду `node bin/decrypt-statistic.js --key=/шлях/до/statistic_private_key.pem`. Буде створено файл `decrypted-statistic.sqlite`. 
Додатково можна вказати параметри `--input-db` зі шляхом до бази даних з зашифрованими даними та `--output-db` зі шляхом де треба створити файл з розшифрованими даними.
