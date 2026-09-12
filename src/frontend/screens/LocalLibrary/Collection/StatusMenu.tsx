import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Dropdown from 'frontend/components/UI/Dropdown'
import { ToggleSwitch } from 'frontend/components/UI'
import ManageStatusesDialog from './ManageStatusesDialog'
import './StatusMenu.css'

type Props = {
  groupByStatus: boolean
  onGroupByStatusChange: (value: boolean) => void
  onStatusesChanged: () => void
}

export default function StatusMenu({
  groupByStatus,
  onGroupByStatusChange,
  onStatusesChanged
}: Props) {
  const { t } = useTranslation()
  const [manageOpen, setManageOpen] = useState(false)

  return (
    <>
      <Dropdown
        title={t('collection.status.menu', 'Status')}
        className="collectionStatusMenu"
        buttonClass="selectStyle"
        popUpOnHover
      >
        <ToggleSwitch
          htmlId="collection-group-status"
          value={groupByStatus}
          handleChange={() => onGroupByStatusChange(!groupByStatus)}
          title={t('collection.group', 'Group by status')}
        />
        <hr />
        <button
          type="button"
          className="collectionStatusMenu__item"
          onClick={() => setManageOpen(true)}
        >
          {t('collection.status.manage', 'Manage statuses…')}
        </button>
      </Dropdown>
      {manageOpen && (
        <ManageStatusesDialog
          onClose={() => {
            setManageOpen(false)
            onStatusesChanged()
          }}
        />
      )}
    </>
  )
}
