// ============================================================
// SMA MAP ROAD — routes.js
// Линии автобусных маршрутов через OpenStreetMap / Overpass
// ============================================================


// ============================================================
// OVERPASS SERVERS
// ============================================================

// Если один сервер даёт 502 / 503 / 504 / тайм-аут,
// автоматически пробуем следующий.

const ROUTE_OVERPASS_SERVERS = [

    "https://overpass.private.coffee/api/interpreter",

    "https://overpass-api.de/api/interpreter",

    "https://overpass.kumi.systems/api/interpreter",

    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"

];


// Широкая область Алматы + пригородов.

const ROUTE_BBOX = {

    south: 42.82,

    west: 76.20,

    north: 43.72,

    east: 77.65

};


const ROUTE_LAYER_PREF_KEY =
    "sma_route_layer_visible";


const ROUTE_REQUEST_TIMEOUT =
    18000;



// ============================================================
// СЛОЙ ЛИНИИ МАРШРУТА
// ============================================================

const routeGeometryLayer =

    L.layerGroup()
        .addTo(map);


// Добавляем линию маршрута
// в переключатель слоёв справа.

if (
    window.smaLayerControl
) {

    window.smaLayerControl.addOverlay(

        routeGeometryLayer,

        "🚌 Линия выбранного маршрута"

    );

}



// ============================================================
// СОХРАНЕНИЕ ВКЛ / ВЫКЛ СЛОЯ
// ============================================================

const savedRouteLayerVisible =

    localStorage.getItem(
        ROUTE_LAYER_PREF_KEY
    );


if (
    savedRouteLayerVisible ===
    "false"
) {

    map.removeLayer(
        routeGeometryLayer
    );

}


map.on(

    "overlayadd",

    function(event) {

        if (
            event.layer ===
            routeGeometryLayer
        ) {

            localStorage.setItem(

                ROUTE_LAYER_PREF_KEY,

                "true"

            );

        }

    }

);


map.on(

    "overlayremove",

    function(event) {

        if (
            event.layer ===
            routeGeometryLayer
        ) {

            localStorage.setItem(

                ROUTE_LAYER_PREF_KEY,

                "false"

            );

        }

    }

);



// ============================================================
// CACHE / STATE
// ============================================================

const routeGeometryCache =
    new Map();


let selectedRouteNumber =
    null;


let routeLoading =
    false;


let routeRequestToken =
    0;



// ============================================================
// CSS
// ============================================================

const routeStyle =

    document.createElement(
        "style"
    );


routeStyle.textContent = `

.route-selector-box {

    margin-top: 11px;

    padding: 10px;

    background: #f4f6f8;

    border-radius: 8px;

}

.route-selector-title {

    margin-bottom: 8px;

    font-size: 12px;

    font-weight: bold;

    color: #64748b;

}

.route-buttons {

    display: flex;

    flex-wrap: wrap;

    gap: 7px;

}

.route-button {

    min-width: 45px;

    padding: 7px 11px;

    border-radius: 7px;

    background: #e5e7eb;

    color: #111827;

    border: 1px solid #cbd5e1;

    cursor: pointer;

    font-weight: bold;

}

.route-button:hover {

    background: #dbeafe;

}

.route-button.active {

    background: #126caa;

    color: white;

    border-color: #126caa;

}

.route-map-info {

    margin-top: 8px;

    padding: 8px 10px;

    border-radius: 7px;

    background: white;

    font-size: 12px;

    line-height: 1.5;

}

.route-map-loading {

    color: #805b00;

}

.route-map-ok {

    color: #146c2e;

}

.route-map-error {

    color: #9a2424;

}

.route-clear {

    margin-top: 8px;

    background: #334155;

    color: white;

}

`;


document.head.appendChild(
    routeStyle
);



// ============================================================
// ПАНЕЛЬ МАРШРУТОВ
// ============================================================

const routeSelectorBox =

    document.createElement(
        "div"
    );


routeSelectorBox.className =
    "route-selector-box";


routeSelectorBox.style.display =
    "none";


routeSelectorBox.innerHTML = `

    <div class="route-selector-title">

        🚌 Показать маршрут на карте

    </div>


    <div
        id="routeButtons"
        class="route-buttons">
    </div>


    <div
        id="routeMapInfo"
        class="route-map-info">

        Выберите номер маршрута.

    </div>


    <button
        id="routeClearButton"
        class="route-clear">

        ✕ Убрать маршрут

    </button>

`;



const infoGrid =

    document.querySelector(
        ".info-grid"
    );


if (infoGrid) {

    infoGrid.insertAdjacentElement(

        "afterend",

        routeSelectorBox

    );

}



const routeButtonsElement =

    document.getElementById(
        "routeButtons"
    );


const routeMapInfoElement =

    document.getElementById(
        "routeMapInfo"
    );


const routeClearButton =

    document.getElementById(
        "routeClearButton"
    );



// ============================================================
// HELPERS
// ============================================================

function routeEscapeHtml(value) {

    return String(
        value ?? ""
    )

    .replace(

        /[&<>'"]/g,

        function(char) {

            return {

                "&":
                    "&amp;",

                "<":
                    "&lt;",

                ">":
                    "&gt;",

                "'":
                    "&#39;",

                "\"":
                    "&quot;"

            }[char];

        }

    );

}



function normalizeRouteRef(route) {

    return String(
        route || ""
    )
    .trim();

}



function escapeOverpassString(value) {

    return String(value)

        .replace(
            /\\/g,
            "\\\\"
        )

        .replace(
            /"/g,
            '\\"'
        );

}



// ============================================================
// ВАРИАНТЫ НОМЕРА МАРШРУТА
// ============================================================

function getRouteRefVariants(route) {

    const raw =

        normalizeRouteRef(
            route
        );


    const variants = [
        raw
    ];


    // ТП7 -> дополнительно пробуем 7

    const tp =

        raw.match(
            /^ТП\s*(.+)$/i
        );


    if (tp) {

        variants.push(

            tp[1]
                .trim()

        );

    }


    // Кириллические буквы
    // иногда могут быть записаны латиницей.

    const mapLetters = {

        "А": "A",

        "В": "B",

        "Е": "E",

        "К": "K",

        "М": "M",

        "Н": "H",

        "О": "O",

        "Р": "P",

        "С": "C",

        "Т": "T",

        "Х": "X"

    };


    if (
        /[АВЕКМНОРСТХ]/i
        .test(raw)
    ) {

        variants.push(

            raw

            .toUpperCase()

            .replace(

                /[АВЕКМНОРСТХ]/g,

                char =>
                    mapLetters[char] ||
                    char

            )

        );

    }


    return [

        ...new Set(

            variants.filter(
                Boolean
            )

        )

    ];

}



// ============================================================
// ОБЛАСТЬ ПОИСКА
// ============================================================

function getRouteSearchBounds() {

    try {

        if (

            typeof activeStop !==
            "undefined"

            &&

            activeStop

            &&

            typeof getStopCoordinates ===
            "function"

        ) {

            const point =

                getStopCoordinates(
                    activeStop
                );


            if (point) {

                // Сначала ищем рядом
                // с выбранным отстоем.
                // Это сильно разгружает Overpass.

                return {

                    south:
                        point.lat - 0.14,

                    west:
                        point.lon - 0.19,

                    north:
                        point.lat + 0.14,

                    east:
                        point.lon + 0.19

                };

            }

        }

    }

    catch(error) {

        console.warn(

            "Не удалось получить координату выбранного отстоя:",

            error

        );

    }


    return ROUTE_BBOX;

}



// ============================================================
// OVERPASS QUERY 1
// ИЩЕМ ТОЛЬКО RELATION
// ============================================================

function buildRelationSearchQuery(
    ref,
    bounds
) {

    const safeRef =

        escapeOverpassString(
            ref
        );


    return `

[out:json]
[timeout:12];

relation
    ["type"="route"]
    ["route"~"^(bus|trolleybus)$"]
    ["ref"="${safeRef}"]
    (
        ${bounds.south},
        ${bounds.west},
        ${bounds.north},
        ${bounds.east}
    );

out ids tags center;

`;

}



// ============================================================
// OVERPASS QUERY 2
// ГЕОМЕТРИЯ ТОЛЬКО НАЙДЕННЫХ RELATIONS
// ============================================================

function buildGeometryQuery(ids) {

    const relations =

        ids

        .map(

            id =>
                `relation(${Number(id)});`

        )

        .join("\n");


    return `

[out:json]
[timeout:22];

(

${relations}

);

way(r);

out geom;

`;

}



// ============================================================
// FETCH С ТАЙМАУТОМ
// ============================================================

async function requestOverpass(
    server,
    query,
    timeoutMs = ROUTE_REQUEST_TIMEOUT
) {

    const controller =

        new AbortController();


    const timer =

        setTimeout(

            () =>
                controller.abort(),

            timeoutMs

        );


    try {

        const body =

            new URLSearchParams({

                data:
                    query

            });


        const response =

            await fetch(

                server,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/x-www-form-urlencoded;charset=UTF-8"

                    },

                    body:
                        body.toString(),

                    signal:
                        controller.signal,

                    cache:
                        "no-store"

                }

            );


        if (!response.ok) {

            throw new Error(

                "HTTP " +
                response.status

            );

        }


        return await response.json();

    }

    catch(error) {

        if (
            error.name ===
            "AbortError"
        ) {

            throw new Error(
                "тайм-аут"
            );

        }


        throw error;

    }

    finally {

        clearTimeout(
            timer
        );

    }

}



// ============================================================
// FALLBACK ПО СЕРВЕРАМ
// ============================================================

async function requestOverpassWithFallback(
    query,
    phase,
    requestToken
) {

    const errors = [];


    for (
        const server of
        ROUTE_OVERPASS_SERVERS
    ) {

        if (
            requestToken !==
            routeRequestToken
        ) {

            throw new Error(
                "Запрос отменён."
            );

        }


        try {

            routeMapInfoElement.className =

                "route-map-info route-map-loading";


            routeMapInfoElement.innerHTML =

                "⏳ " +

                routeEscapeHtml(
                    phase
                )

                +

                "<br><small>"

                +

                routeEscapeHtml(
                    server
                )

                +

                "</small>";


            return await requestOverpass(

                server,

                query

            );

        }

        catch(error) {

            console.warn(

                "Overpass failed:",

                server,

                error

            );


            errors.push(

                server +

                " — " +

                error.message

            );

        }

    }


    throw new Error(

        "Все серверы Overpass временно недоступны или не успели ответить."

    );

}



// ============================================================
// ПОИСК RELATION
// ============================================================

async function findRouteRelations(
    route,
    requestToken
) {

    const variants =

        getRouteRefVariants(
            route
        );


    const localBounds =

        getRouteSearchBounds();


    // Сначала маленькая область,
    // потом весь Алматы.

    const boundsVariants = [

        localBounds

    ];


    const isDifferentFromWide =

        localBounds.south !==
            ROUTE_BBOX.south

        ||

        localBounds.west !==
            ROUTE_BBOX.west

        ||

        localBounds.north !==
            ROUTE_BBOX.north

        ||

        localBounds.east !==
            ROUTE_BBOX.east;


    if (
        isDifferentFromWide
    ) {

        boundsVariants.push(
            ROUTE_BBOX
        );

    }


    for (
        const bounds of
        boundsVariants
    ) {

        for (
            const ref of
            variants
        ) {

            const data =

                await requestOverpassWithFallback(

                    buildRelationSearchQuery(

                        ref,

                        bounds

                    ),

                    "Ищу relation маршрута " +

                        route +

                        "…",

                    requestToken

                );


            const relations =

                (
                    data.elements ||
                    []
                )

                .filter(

                    element =>
                        element.type ===
                        "relation"

                );


            if (
                relations.length >
                0
            ) {

                return {

                    matchedRef:
                        ref,

                    relations:

                        relations.slice(
                            0,
                            6
                        )

                };

            }

        }

    }


    return {

        matchedRef:

            variants[0] ||
            route,

        relations:
            []

    };

}



// ============================================================
// ЗАГРУЗКА ГЕОМЕТРИИ
// ============================================================

async function loadRouteGeometry(
    route,
    requestToken
) {

    const key =

        normalizeRouteRef(
            route
        );


    if (
        routeGeometryCache.has(
            key
        )
    ) {

        return routeGeometryCache.get(
            key
        );

    }


    const search =

        await findRouteRelations(

            key,

            requestToken

        );


    if (
        search.relations.length ===
        0
    ) {

        const empty = {

            matchedRef:
                search.matchedRef,

            relations:
                [],

            segments:
                []

        };


        routeGeometryCache.set(

            key,

            empty

        );


        return empty;

    }


    const ids =

        search.relations.map(

            relation =>
                relation.id

        );


    const geometryData =

        await requestOverpassWithFallback(

            buildGeometryQuery(
                ids
            ),

            "Загружаю геометрию маршрута " +

                route +

                "…",

            requestToken

        );


    const seenWays =
        new Set();


    const segments =
        [];


    for (
        const element of
        geometryData.elements ||
        []
    ) {

        if (

            element.type !==
            "way"

            ||

            !Array.isArray(
                element.geometry
            )

        ) {

            continue;

        }


        if (
            seenWays.has(
                element.id
            )
        ) {

            continue;

        }


        seenWays.add(
            element.id
        );


        const points =

            element.geometry

            .map(

                point => [

                    Number(
                        point.lat
                    ),

                    Number(
                        point.lon
                    )

                ]

            )

            .filter(

                point =>

                    Number.isFinite(
                        point[0]
                    )

                    &&

                    Number.isFinite(
                        point[1]
                    )

            );


        if (
            points.length >=
            2
        ) {

            segments.push(
                points
            );

        }

    }


    const result = {

        matchedRef:
            search.matchedRef,

        relations:
            search.relations,

        segments:
            segments

    };


    routeGeometryCache.set(

        key,

        result

    );


    return result;

}



// ============================================================
// УБРАТЬ МАРШРУТ
// ============================================================

function clearDisplayedRoute(
    resetMessage = true
) {

    routeRequestToken++;


    routeGeometryLayer
        .clearLayers();


    selectedRouteNumber =
        null;


    routeLoading =
        false;


    if (
        routeButtonsElement
    ) {

        routeButtonsElement

            .querySelectorAll(
                ".route-button"
            )

            .forEach(

                button =>

                    button.classList.remove(
                        "active"
                    )

            );

    }


    if (

        resetMessage

        &&

        routeMapInfoElement

    ) {

        routeMapInfoElement.className =

            "route-map-info";


        routeMapInfoElement.innerHTML =

            "Выберите номер маршрута.";

    }

}



// ============================================================
// ПОКАЗАТЬ МАРШРУТ НА КАРТЕ
// ============================================================

async function showRouteOnMap(route) {

    if (
        routeLoading
    ) {

        // Новый клик логически
        // отменяет предыдущий запрос.

        routeRequestToken++;

    }


    const requestToken =

        ++routeRequestToken;


    routeLoading =
        true;


    selectedRouteNumber =

        normalizeRouteRef(
            route
        );


    routeGeometryLayer
        .clearLayers();


    routeButtonsElement

        .querySelectorAll(
            ".route-button"
        )

        .forEach(

            function(button) {

                button.classList.toggle(

                    "active",

                    button.dataset.route ===
                    selectedRouteNumber

                );

            }

        );


    routeMapInfoElement.className =

        "route-map-info route-map-loading";


    routeMapInfoElement.innerHTML =

        "⏳ Ищу маршрут <b>" +

        routeEscapeHtml(
            selectedRouteNumber
        )

        +

        "</b>…";


    try {

        const result =

            await loadRouteGeometry(

                selectedRouteNumber,

                requestToken

            );


        if (
            requestToken !==
            routeRequestToken
        ) {

            return;

        }


        if (
            result.relations.length ===
            0
        ) {

            routeMapInfoElement.className =

                "route-map-info route-map-error";


            routeMapInfoElement.innerHTML =

                "⚠ Маршрут <b>" +

                routeEscapeHtml(
                    selectedRouteNumber
                )

                +

                "</b> не найден в OpenStreetMap по этому номеру."

                +

                "<br><br>"

                +

                "Сервер ответил нормально — это не ошибка 504.";


            return;

        }


        if (
            result.segments.length ===
            0
        ) {

            throw new Error(

                "Relation найдена, но дорожная геометрия не получена."

            );

        }


        for (
            const points of
            result.segments
        ) {

            L.polyline(

                points,

                {

                    weight:
                        6,

                    opacity:
                        0.9

                }

            )

            .addTo(
                routeGeometryLayer
            );

        }


        // Если слой линии сейчас включён,
        // приближаемся к маршруту.

        if (
            map.hasLayer(
                routeGeometryLayer
            )
        ) {

            const bounds =

                routeGeometryLayer
                    .getBounds();


            if (

                bounds

                &&

                bounds.isValid()

            ) {

                map.fitBounds(

                    bounds,

                    {

                        padding:
                            [40, 40],

                        maxZoom:
                            16

                    }

                );

            }

        }


        const directions =

            result.relations

            .map(

                function(relation) {

                    const from =

                        relation.tags
                            ?.from ||
                        "";


                    const to =

                        relation.tags
                            ?.to ||
                        "";


                    if (
                        !from &&
                        !to
                    ) {

                        return "";

                    }


                    return (

                        "<br>• "

                        +

                        routeEscapeHtml(
                            from || "?"
                        )

                        +

                        " → "

                        +

                        routeEscapeHtml(
                            to || "?"
                        )

                    );

                }

            )

            .filter(
                Boolean
            )

            .join("");


        routeMapInfoElement.className =

            "route-map-info route-map-ok";


        routeMapInfoElement.innerHTML =

            "✅ Маршрут <b>"

            +

            routeEscapeHtml(
                selectedRouteNumber
            )

            +

            "</b> показан."

            +

            "<br>Найдено OSM relation: "

            +

            result.relations.length

            +

            directions

            +

            "<br><small>"

            +

            "Линию можно включать и выключать справа: "

            +

            "«🚌 Линия выбранного маршрута»."

            +

            "</small>";

    }

    catch(error) {

        if (
            requestToken !==
            routeRequestToken
        ) {

            return;

        }


        console.error(
            error
        );


        routeGeometryLayer
            .clearLayers();


        routeMapInfoElement.className =

            "route-map-info route-map-error";


        const errorText =

            error.message ===
            "Запрос отменён."

                ? "Запрос отменён."

                : (

                    "❌ "

                    +

                    routeEscapeHtml(
                        error.message
                    )

                    +

                    "<br><br>"

                    +

                    "Это ошибка сервера/тайм-аут, а не доказательство того, что маршрута нет."

                );


        routeMapInfoElement.innerHTML =

            errorText;

    }

    finally {

        if (
            requestToken ===
            routeRequestToken
        ) {

            routeLoading =
                false;

        }

    }

}



// ============================================================
// КНОПКИ МАРШРУТОВ ВЫБРАННОГО ОТСТОЯ
// ============================================================

function renderRouteButtonsForStop() {

    if (

        typeof currentMode ===
            "undefined"

        ||

        currentMode !==
            "stops"

        ||

        !activeStop

    ) {

        routeSelectorBox.style.display =

            "none";


        return;

    }


    const routes = [

        ...new Set(

            (
                activeStop.routes ||
                []
            )

            .map(
                String
            )

        )

    ];


    if (
        routes.length ===
        0
    ) {

        routeSelectorBox.style.display =

            "none";


        return;

    }


    routeSelectorBox.style.display =

        "block";


    routeButtonsElement.innerHTML =

        "";


    for (
        const route of
        routes
    ) {

        const button =

            document.createElement(
                "button"
            );


        button.className =

            "route-button";


        button.dataset.route =

            route;


        button.textContent =

            route;


        if (
            selectedRouteNumber ===
            route
        ) {

            button.classList.add(
                "active"
            );

        }


        button.addEventListener(

            "click",

            function() {

                showRouteOnMap(
                    route
                );

            }

        );


        routeButtonsElement.appendChild(
            button
        );

    }

}



// ============================================================
// КНОПКА УБРАТЬ МАРШРУТ
// ============================================================

routeClearButton.addEventListener(

    "click",

    function() {

        clearDisplayedRoute(
            true
        );

    }

);



// ============================================================
// ПОДКЛЮЧЕНИЕ К ОСНОВНОМУ index.html
// ============================================================


// После открытия отстоя
// показываем кнопки маршрутов.

const originalRenderStopPanel =

    renderStopPanel;


renderStopPanel = function() {

    originalRenderStopPanel();


    renderRouteButtonsForStop();

};



// При сбросе панели
// блок маршрутов скрываем.

const originalResetPanel =

    resetPanel;


resetPanel = function() {

    originalResetPanel();


    routeSelectorBox.style.display =

        "none";

};



// При выборе другого отстоя
// старую линию убираем.

const originalSelectStop =

    selectStop;


selectStop = function(id) {

    clearDisplayedRoute(
        true
    );


    originalSelectStop(
        id
    );

};



// При переходе в режим разворотов
// линию маршрута убираем.

turnsModeButton.addEventListener(

    "click",

    function() {

        clearDisplayedRoute(
            true
        );


        routeSelectorBox.style.display =

            "none";

    }

);



// ============================================================
// ГОТОВО
// ============================================================

console.log(

    "routes.js подключён: fallback Overpass + рабочий layer control"

);