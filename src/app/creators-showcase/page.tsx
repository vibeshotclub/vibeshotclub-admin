'use client'

import { useState, useCallback } from 'react'
import { Card, Avatar, Typography, App, Spin, Tag, Space, Button } from 'antd'
import { XOutlined, SaveOutlined, HolderOutlined } from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useCreators } from '@/hooks/useCreators'
import type { TwitterCreator } from '@/types/database'

const { Text, Link } = Typography

// 可拖拽的创作者卡片
function SortableCreatorCard({ creator }: { creator: TwitterCreator }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: creator.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        hoverable
        style={{
          background: 'rgba(30, 30, 40, 0.8)',
          border: isDragging ? '2px solid #a855f7' : '1px solid rgba(168, 85, 247, 0.2)',
          borderRadius: 12,
        }}
        styles={{ body: { padding: 16 } }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* 拖拽手柄 */}
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              color: 'rgba(255,255,255,0.3)',
              padding: '4px 0',
            }}
          >
            <HolderOutlined style={{ fontSize: 16 }} />
          </div>

          {/* 头像 */}
          <Avatar
            src={creator.avatar_url}
            icon={<XOutlined />}
            size={48}
            style={{
              border: '2px solid rgba(168, 85, 247, 0.3)',
              flexShrink: 0,
            }}
          />

          {/* 信息 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: 4 }}>
              <Link
                href={creator.x_url || `https://x.com/${creator.username}`}
                target="_blank"
                style={{ fontWeight: 500 }}
              >
                @{creator.username}
              </Link>
              {creator.is_vsc && (
                <Tag color="purple" style={{ marginLeft: 8, fontSize: 10 }}>
                  VSC
                </Tag>
              )}
            </div>
            {creator.display_name && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                {creator.display_name}
              </Text>
            )}
            <Text type="secondary" style={{ fontSize: 11 }}>
              入库 {creator.success_count} 条
            </Text>
          </div>

          {/* 排序号 */}
          <div
            style={{
              background: 'rgba(168, 85, 247, 0.2)',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 12,
              color: '#a855f7',
            }}
          >
            #{creator.sort_order}
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function CreatorsShowcasePage() {
  const { message } = App.useApp()
  const { creators, isLoading, mutate } = useCreators('sort_order')
  const [localCreators, setLocalCreators] = useState<TwitterCreator[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 初始化本地状态
  useState(() => {
    if (creators.length > 0 && localCreators.length === 0) {
      setLocalCreators(creators)
    }
  })

  // 当远程数据变化时更新本地
  if (creators.length > 0 && localCreators.length === 0) {
    setLocalCreators(creators)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setLocalCreators((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        // 更新 sort_order
        return newItems.map((item, index) => ({
          ...item,
          sort_order: index + 1,
        }))
      })
      setHasChanges(true)
    }
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updates = localCreators.map((creator, index) => ({
        id: creator.id,
        sort_order: index + 1,
      }))

      const response = await fetch('/api/creators', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '保存失败')
      }

      message.success('排序已保存')
      setHasChanges(false)
      mutate()
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setLocalCreators(creators)
    setHasChanges(false)
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
          <Spin size="large" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <Card
        title={
          <Space>
            <XOutlined />
            <span>创作者展示</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
              拖拽卡片调整前端展示顺序
            </Text>
          </Space>
        }
        extra={
          <Space>
            {hasChanges && (
              <>
                <Button onClick={handleReset}>
                  重置
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={isSaving}
                  onClick={handleSave}
                >
                  保存排序
                </Button>
              </>
            )}
          </Space>
        }
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localCreators.map((c) => c.id)}
            strategy={rectSortingStrategy}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
              }}
            >
              {localCreators.map((creator) => (
                <SortableCreatorCard key={creator.id} creator={creator} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {localCreators.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.45)' }}>
            暂无创作者数据
          </div>
        )}
      </Card>
    </AdminLayout>
  )
}