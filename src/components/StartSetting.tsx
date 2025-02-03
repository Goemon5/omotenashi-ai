import i18n from 'i18next'
import { useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { IconButton } from './iconButton'
import { Link } from './link'
import { isLanguageSupported } from '@/features/constants/settings'

export const StartSetting = () => {
  // homeStoreからshowIntroductionの状態を取得
  const showIntroduction = homeStore((s) => s.showIntroduction)
  // settingsStoreからselectLanguageの状態を取得
  const selectLanguage = settingsStore((s) => s.selectLanguage)

  // displayIntroductionとopenedの状態を管理するためのuseStateフック
  const [displayIntroduction, setDisplayIntroduction] = useState(false)
  const [opened, setOpened] = useState(true)

  // useTranslationフックを使用して翻訳機能を利用
  const { t } = useTranslation()

  // showIntroductionの状態が変更されたときにdisplayIntroductionを更新
  useEffect(() => {
    setDisplayIntroduction(homeStore.getState().showIntroduction)
  }, [showIntroduction])

  // 言語を更新する関数
  const updateLanguage = () => {
    console.log('i18n.language', i18n.language)

    let languageCode = i18n.language

    // 言語がサポートされているか確認し、settingsStoreのselectLanguageを更新
    settingsStore.setState({
      selectLanguage: isLanguageSupported(languageCode) ? languageCode : 'ja',
    })
  }

  return displayIntroduction && opened ? (
    <div className="absolute z-40 w-full h-full px-24 py-40 bg-black/30 font-M_PLUS_2">
      <div className="relative mx-auto my-auto max-w-3xl max-h-full p-24 overflow-auto bg-white rounded-16">
        {/* 閉じるボタン */}
        <IconButton
          iconName="24/Close"
          isProcessing={false}
          onClick={() => {
            setOpened(false)
            updateLanguage()
          }}
          className="absolute top-8 right-8 bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled text-white"
        ></IconButton>

        {/* アプリケーションについてのセクション */}
        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">
            {t('AboutThisApplication')}
          </div>
          <div>
            <Trans i18nKey="AboutThisApplicationDescription" />
          </div>
        </div>

        {/* 技術紹介のセクション */}
        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">
            {t('TechnologyIntroduction')}
          </div>
          <div>
            <Trans
              i18nKey="TechnologyIntroductionDescription1"
              components={{ b: <b /> }}
            />
            <Link
              url={'https://github.com/pixiv/ChatVRM'}
              label={t('TechnologyIntroductionLink1')}
            />
            {t('TechnologyIntroductionDescription2')}
          </div>
          <div className="my-16">
            {t('TechnologyIntroductionDescription3')}
            <Link
              url={'https://github.com/pixiv/three-vrm'}
              label={'@pixiv/three-vrm'}
            />
            {t('TechnologyIntroductionDescription4')}
            <Link
              url={
                'https://openai.com/blog/introducing-chatgpt-and-whisper-apis'
              }
              label={'OpenAI API'}
            />
            {t('TechnologyIntroductionDescription5')}
            <Link
              url={
                'https://developers.rinna.co.jp/product/#product=koeiromap-free'
              }
              label={'Koemotion'}
            />
            {t('TechnologyIntroductionDescription6')}
            <Link
              url={'https://note.com/nike_cha_n/n/ne98acb25e00f'}
              label={t('TechnologyIntroductionLink2')}
            />
            {t('TechnologyIntroductionDescription7')}
          </div>
          <div className="my-16">
            {t('SourceCodeDescription1')}
            <br />
            {t('RepositoryURL')}
            <span> </span>
            <Link
              url={'https://github.com/tegnike/aituber-kit'}
              label={'https://github.com/tegnike/aituber-kit'}
            />
          </div>
          <div className="my-16">{t('SourceCodeDescription2')}</div>
        </div>

        {/* 次回表示しないチェックボックス */}
        <div className="my-24">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showIntroduction}
              onChange={(e) => {
                homeStore.setState({
                  showIntroduction: e.target.checked,
                })
                updateLanguage()
              }}
              className="mr-8"
            />
            <span>{t('DontShowIntroductionNextTime')}</span>
          </label>
        </div>

        {/* 閉じるボタン */}
        <div className="my-24">
          <button
            onClick={() => {
              setOpened(false)
              updateLanguage()
            }}
            className="font-bold bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled text-white px-24 py-8 rounded-oval"
          >
            {t('Close')}
          </button>
        </div>

        {/* 言語が日本語の場合のメッセージ */}
        {selectLanguage === 'ja' && (
          <div className="my-24">
            <p>
              You can select the language from the settings. Japanese, English,
              Traditional Chinese and Korean are available.
            </p>
          </div>
        )}
      </div>
    </div>
  ) : null
}
