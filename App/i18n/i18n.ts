import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from '../locales/en.json';
import de from '../locales/de.json';

export const DEFAULT_LANG = 'en';

const deviceLang = Localization.getLocales?.()[0]?.languageCode;
const initialLang = deviceLang === 'de' ? 'de' : DEFAULT_LANG;

i18n
  .use(initReactI18next)
  .init({
    lng: initialLang,
    fallbackLng: DEFAULT_LANG,
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
