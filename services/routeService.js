class SimpleRouteService {
  static async createRoute(restaurantAddress, deliveries) {
    const route = deliveries.map((delivery, index) => {
      return {
        ...delivery.toObject(),
        routeOrder: index + 1,
        estimatedTime: 5,
        distance: "0.5",
        fullAddress: `${delivery.address}, Riomar, Barranquilla, Atlántico`
      };
    });
  
    return {
      restaurant: {
        name: 'Restaurante',
        address: restaurantAddress || 'Eduardo Santos, Barranquilla, Atlántico'
      },  
      deliveries: route,
      totalDeliveries: route.length,
      totalEstimatedTime: route.length * 5,
      totalDistance: (route.length * 0.5).toFixed(1),
      message: `Ruta con ${route.length} entregas en Eduardo Santos, Barranquilla`
    };
  } 
  
  static sortByInvoice(deliveries) {
    return [...deliveries].sort((a, b) => {
      const numA = parseInt(a.invoiceNumber.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.invoiceNumber.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }
  
  static sortByCreationTime(deliveries) {
    return [...deliveries].sort((a, b) => {
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }
};

module.exports = SimpleRouteService;