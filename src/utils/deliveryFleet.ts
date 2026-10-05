import type {
  DeliveryPartner,
  DeliveryTracking,
  DeliveryTrackingStage,
  DeliveryWaypoint,
  Order,
  CafeInfo,
} from '../types.js';

// The delivery fleet roster lives on the backend (real staff accounts with
// role: 'delivery_person' in store.adminUsers) — see src/services/api.ts's
// getDeliveryPartners/addDeliveryPartner/updateDeliveryPartner/toggleDeliveryPartnerDuty/
// removeDeliveryPartner. There is no local mock or localStorage-backed registry here.

export const STAGE_CONFIG: Record<
  DeliveryTrackingStage,
  {
    label: string;
    description: string;
    progressPercent: number;
    badgeColor: string;
    icon: string;
    stepIndex: number;
  }
> = {
  assigned: {
    label: 'Partner Assigned',
    description: 'Rider confirmed and heading to OTT Restaurant',
    progressPercent: 15,
    badgeColor: 'bg-amber-500 text-stone-950',
    icon: 'Bike',
    stepIndex: 1,
  },
  arrived_at_pickup: {
    label: 'Rider at Restaurant',
    description: 'Partner reached OTT Kukas Kitchen counter for pickup',
    progressPercent: 30,
    badgeColor: 'bg-blue-500 text-white',
    icon: 'Store',
    stepIndex: 2,
  },
  picked_up: {
    label: 'Order Picked Up',
    description: 'Food packaged hot & fresh, leaving restaurant',
    progressPercent: 50,
    badgeColor: 'bg-orange-500 text-white',
    icon: 'PackageCheck',
    stepIndex: 3,
  },
  on_the_way: {
    label: 'On the Way (Live GPS)',
    description: 'Rider is in transit along NH-48 Jaipur',
    progressPercent: 78,
    badgeColor: 'bg-purple-600 text-white',
    icon: 'Navigation',
    stepIndex: 4,
  },
  near_destination: {
    label: 'Arriving Soon',
    description: 'Rider is within 2-3 mins of delivery doorstep',
    progressPercent: 92,
    badgeColor: 'bg-emerald-500 text-white',
    icon: 'MapPin',
    stepIndex: 5,
  },
  delivered: {
    label: 'Delivered',
    description: 'Order safely handed over to customer. Enjoy your meal!',
    progressPercent: 100,
    badgeColor: 'bg-emerald-600 text-white',
    icon: 'CheckCircle2',
    stepIndex: 6,
  },
};

export function createInitialDeliveryTracking(
  order: Order,
  partner?: DeliveryPartner,
  options?: {
    estimatedMinutes?: number;
    initialStage?: DeliveryTrackingStage;
    notes?: string;
    cafeInfo?: CafeInfo;
  }
): DeliveryTracking {
  const stage = options?.initialStage || 'assigned';
  const estMins = options?.estimatedMinutes || (order.isCustomCake ? 40 : 25);
  const now = new Date();
  const arrivalDate = new Date(now.getTime() + estMins * 60 * 1000);
  const arrivalTimeStr = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const effectivePartner: DeliveryPartner = partner || {
    id: 'unassigned',
    name: 'Pending Assignment',
    phone: '',
    vehicleType: 'bike',
    vehicleNumber: 'Pending',
  };

  const waypoints: DeliveryWaypoint[] = [
    {
      id: 'wp-1',
      name: 'Out of the Town (OTT) Restro',
      landmark: 'SP 41 B, NH-48, Kukas, Jaipur',
      distanceKm: 0,
      completed: stage !== 'assigned',
      active: stage === 'assigned' || stage === 'arrived_at_pickup',
      timeEstimate: '0 mins',
    },
    {
      id: 'wp-2',
      name: 'RIICO Industrial Area & Arya Junction',
      landmark: 'NH-48 Jaipur Bypass',
      distanceKm: 1.8,
      completed: stage === 'on_the_way' || stage === 'near_destination' || stage === 'delivered',
      active: stage === 'picked_up',
      timeEstimate: '5 mins',
    },
    {
      id: 'wp-3',
      name: 'Toll Plaza & Amity Corridor',
      landmark: 'Jaipur Corridor Stretch',
      distanceKm: 4.5,
      completed: stage === 'near_destination' || stage === 'delivered',
      active: stage === 'on_the_way',
      timeEstimate: '12 mins',
    },
    {
      id: 'wp-4',
      name: 'Destination Doorstep',
      landmark: order.deliveryAddress || 'Customer Address',
      distanceKm: 8.2,
      completed: stage === 'delivered',
      active: stage === 'near_destination',
      timeEstimate: `${estMins} mins`,
    },
  ];

  const nowIso = now.toISOString();

  return {
    partner: effectivePartner,
    stage,
    statusNotes: options?.notes || (partner ? `Assigned to ${partner.name} (${partner.vehicleNumber})` : 'Awaiting delivery partner assignment'),
    assignedAt: nowIso,
    arrivedAtPickupAt: stage !== 'assigned' ? nowIso : undefined,
    pickedUpAt: stage === 'picked_up' || stage === 'on_the_way' || stage === 'near_destination' || stage === 'delivered' ? nowIso : undefined,
    deliveredAt: stage === 'delivered' ? nowIso : undefined,
    estimatedDeliveryMinutes: estMins,
    estimatedArrivalTime: arrivalTimeStr,
    progressPercent: STAGE_CONFIG[stage].progressPercent,
    currentLocationLabel:
      stage === 'assigned'
        ? (partner ? `Heading towards OTT Restro Kukas` : 'Awaiting rider allocation')
        : stage === 'arrived_at_pickup'
        ? `At OTT Kitchen Counter`
        : stage === 'picked_up'
        ? (partner ? `Leaving OTT Kukas on ${partner.vehicleNumber}` : 'Picked up for delivery')
        : stage === 'on_the_way'
        ? `Cruising NH-48 Jaipur-Delhi Road`
        : stage === 'near_destination'
        ? `Arrived in your locality / Gate`
        : `Delivered at doorstep`,
    pickupLocation: {
      name: options?.cafeInfo?.name || 'Out of the Town - Restro and Bakery',
      address: options?.cafeInfo?.address || 'SP 41 B, RIICO Industrial Area, NH-48, Kukas, Jaipur, Rajasthan 302038',
      phone: options?.cafeInfo?.phone || '+91 98289 19626',
      lat: 27.0543,
      lng: 75.8988,
    },
    deliveryLocation: {
      customerName: order.customerName,
      address: order.deliveryAddress || 'Kukas / Jaipur Delivery Address',
      phone: order.customerPhone,
      lat: 26.9855,
      lng: 75.8513,
    },
    waypoints,
    timeline: [
      {
        stage: 'assigned',
        title: partner ? 'Delivery Partner Assigned' : 'Awaiting Delivery Partner',
        description: partner
          ? `${partner.name} (${partner.vehicleType.toUpperCase()} ${partner.vehicleNumber}) assigned for delivery`
          : 'Order accepted, delivery partner assignment pending',
        timestamp: nowIso,
        completed: true,
      },
      ...(stage !== 'assigned'
        ? [
            {
              stage: 'arrived_at_pickup' as DeliveryTrackingStage,
              title: 'Rider Reached OTT Kitchen',
              description: 'Partner verified order with restaurant manager',
              timestamp: nowIso,
              completed: true,
            },
          ]
        : []),
      ...(stage === 'picked_up' || stage === 'on_the_way' || stage === 'near_destination' || stage === 'delivered'
        ? [
            {
              stage: 'picked_up' as DeliveryTrackingStage,
              title: 'Order Picked Up & Hot Sealed',
              description: 'Fresh packaging verified with tamper-proof seal',
              timestamp: nowIso,
              completed: true,
            },
          ]
        : []),
    ],
  };
}

export function advanceDeliveryTrackingStage(
  current: DeliveryTracking,
  newStage: DeliveryTrackingStage,
  notes?: string
): DeliveryTracking {
  const now = new Date();
  const nowIso = now.toISOString();
  const stageCfg = STAGE_CONFIG[newStage];

  const updatedTimeline = [...current.timeline];
  if (!updatedTimeline.some((t) => t.stage === newStage)) {
    updatedTimeline.push({
      stage: newStage,
      title: stageCfg.label,
      description: notes || stageCfg.description,
      timestamp: nowIso,
      completed: true,
    });
  }

  const updatedWaypoints = current.waypoints.map((wp) => {
    if (newStage === 'delivered') {
      return { ...wp, completed: true, active: false };
    }
    if (newStage === 'near_destination' && wp.id === 'wp-4') {
      return { ...wp, active: true, completed: false };
    }
    if (newStage === 'on_the_way' && (wp.id === 'wp-2' || wp.id === 'wp-3')) {
      return { ...wp, completed: wp.id === 'wp-2', active: wp.id === 'wp-3' };
    }
    return wp;
  });

  return {
    ...current,
    stage: newStage,
    statusNotes: notes || stageCfg.description,
    progressPercent: stageCfg.progressPercent,
    currentLocationLabel:
      newStage === 'arrived_at_pickup'
        ? `At OTT Kitchen Counter (Kukas)`
        : newStage === 'picked_up'
        ? `Picked up from OTT Kitchen Counter`
        : newStage === 'on_the_way'
        ? `Cruising NH-48 Jaipur-Delhi Road`
        : newStage === 'near_destination'
        ? `Arrived in your locality / Gate`
        : `Delivered at doorstep`,
    pickedUpAt: newStage === 'picked_up' ? nowIso : current.pickedUpAt,
    deliveredAt: newStage === 'delivered' ? nowIso : current.deliveredAt,
    waypoints: updatedWaypoints,
    timeline: updatedTimeline,
  };
}
