import { createSignal, onMount } from "solid-js";
import { getRequestEvent, isServer } from "solid-js/web";

export const createLocale = () => {
    let initialLocale = "en-GB";

    if (isServer) {
        const ev = getRequestEvent();
        const acceptLanguage = ev?.request.headers.get("accept-language");
        if (acceptLanguage) {
            const locales = acceptLanguage.split(",");
            initialLocale = locales[0];
        }
    }

    const [locale, setLocale] = createSignal(initialLocale);

    onMount(() => {
        setLocale(navigator.language);
    })

    return locale;
};