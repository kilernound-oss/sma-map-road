// ============================================================
// SMA MAP ROAD
// АВТОМАТИЧЕСКАЯ БАЗА РАЗВОРОТОВ
//
// Источник маршрутов: stops.js
//
// ВАЖНО:
// - все маршруты добавляются автоматически;
// - статус у всех сначала "НЕ ПРОВЕРЕНО";
// - если в stops.js у одного маршрута есть две известные точки,
//   вторая точка используется только как КАНДИДАТ;
// - если второй точки нет — координаты остаются пустыми.
// ============================================================


var turnarounds = (function () {

    // --------------------------------------------------------
    // СОБИРАЕМ ВСЕ МАРШРУТЫ ИЗ stops.js
    // --------------------------------------------------------

    const routeMap = new Map();


    stops.forEach(function (stop) {

        const routes =
            stop.routes || [];


        routes.forEach(function (rawRoute) {

            const route =
                String(rawRoute).trim();


            if (!routeMap.has(route)) {

                routeMap.set(
                    route,
                    []
                );

            }


            routeMap
                .get(route)
                .push({

                    name:
                        stop.name || "",

                    lat:
                        stop.lat,

                    lon:
                        stop.lon,

                    url:
                        stop.url || "",

                    parks:
                        stop.parks || []

                });

        });

    });



    // --------------------------------------------------------
    // УБИРАЕМ ДУБЛИ ТОЧЕК
    // --------------------------------------------------------

    function uniquePoints(points) {

        const result = [];

        const used =
            new Set();


        points.forEach(function (point) {

            const key =

                String(point.name)
                    .trim()
                    .toLowerCase();


            if (!used.has(key)) {

                used.add(key);

                result.push(point);

            }

        });


        return result;

    }



    // --------------------------------------------------------
    // ПРОВЕРКА КООРДИНАТ
    // --------------------------------------------------------

    function hasCoords(point) {

        if (!point) {
            return false;
        }


        const lat =
            Number(point.lat);

        const lon =
            Number(point.lon);


        return (

            Number.isFinite(lat) &&
            Number.isFinite(lon) &&

            lat >= 42 &&
            lat <= 45 &&

            lon >= 75 &&
            lon <= 80

        );

    }



    // --------------------------------------------------------
    // ID РАЗВОРОТА
    // --------------------------------------------------------

    function makeTurnaroundId(route) {

        return (

            "TURN-" +

            String(route)

                .replace(
                    /[^0-9A-Za-zА-Яа-яЁё]+/g,
                    "_"
                )

                .replace(
                    /^_+|_+$/g,
                    ""
                )

        );

    }



    // --------------------------------------------------------
    // NATURAL SORT
    // 2, 3, 10, 11, 120А, ТП1...
    // --------------------------------------------------------

    function routeSort(a, b) {

        return String(a.route)
            .localeCompare(

                String(b.route),

                "ru",

                {
                    numeric: true,
                    sensitivity: "base"
                }

            );

    }



    // --------------------------------------------------------
    // СОЗДАЁМ ВСЕ РАЗВОРОТЫ
    // --------------------------------------------------------

    const result = [];


    routeMap.forEach(

        function (
            rawPoints,
            route
        ) {

            const points =
                uniquePoints(
                    rawPoints
                );


            // первая известная точка маршрута

            const first =
                points[0] || null;


            // вторая известная точка маршрута

            const second =
                points.length > 1
                    ? points[1]
                    : null;



            // ------------------------------------------------
            // КООРДИНАТЫ
            //
            // Если есть вторая известная точка:
            // используем её ТОЛЬКО КАК КАНДИДАТ.
            //
            // Если второй точки нет:
            // координаты неизвестны.
            // ------------------------------------------------

            let lat =
                null;

            let lon =
                null;


            if (
                second &&
                hasCoords(second)
            ) {

                lat =
                    Number(second.lat);

                lon =
                    Number(second.lon);

            }



            // ------------------------------------------------
            // ВСЕ АВТОПАРКИ ЭТОГО МАРШРУТА
            // ------------------------------------------------

            const parks =
                [];


            points.forEach(

                function (point) {

                    (
                        point.parks ||
                        []
                    ).forEach(

                        function (park) {

                            if (
                                !parks.includes(park)
                            ) {

                                parks.push(park);

                            }

                        }

                    );

                }

            );



            // ------------------------------------------------
            // СТАТУС
            // ------------------------------------------------

            let status =
                "НЕ ПРОВЕРЕНО";


            // ------------------------------------------------
            // ПРИМЕЧАНИЕ
            // ------------------------------------------------

            let note = "";


            if (
                points.length >= 2
            ) {

                note =

                    "Автоматический кандидат. " +

                    "В базе найдены две точки маршрута. " +

                    "Нужно проверить реальное место разворота по 2ГИС.";

            }

            else {

                note =

                    "В базе известна только одна точка маршрута. " +

                    "Вторую конечную и координату разворота нужно найти.";

            }



            // ------------------------------------------------
            // ДОБАВЛЯЕМ
            // ------------------------------------------------

            result.push({

                id:
                    makeTurnaroundId(
                        route
                    ),

                route:
                    String(route),

                // известный отстой / точка

                from:
                    first
                        ? first.name
                        : "—",

                // предполагаемая вторая конечная

                terminal:
                    second
                        ? second.name
                        : "НУЖНО НАЙТИ",

                // координата кандидата

                lat:
                    lat,

                lon:
                    lon,

                // ссылка 2ГИС второй точки,
                // если она уже есть в нашей базе

                url:
                    second
                        ? second.url
                        : "",

                // маршрутные автопарки

                parks:
                    parks,

                // все известные точки этого маршрута

                knownStops:

                    points.map(

                        function (point) {

                            return point.name;

                        }

                    ),

                status:
                    status,

                note:
                    note

            });

        }

    );



    // --------------------------------------------------------
    // СОРТИРУЕМ
    // --------------------------------------------------------

    result.sort(
        routeSort
    );



    // --------------------------------------------------------
    // ИНФОРМАЦИЯ В КОНСОЛЬ
    // --------------------------------------------------------

    console.log(
        "Развороты загружены:",
        result.length
    );


    console.log(

        "С координатой-кандидатом:",

        result.filter(

            function (item) {

                return (

                    item.lat !== null &&
                    item.lon !== null

                );

            }

        ).length

    );


    console.log(

        "Без координат:",

        result.filter(

            function (item) {

                return (

                    item.lat === null ||
                    item.lon === null

                );

            }

        ).length

    );


    return result;

})();